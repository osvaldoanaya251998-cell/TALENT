
-- =========================================================
-- PROFILES (unique candidate profile per authenticated user)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text,
  email text,
  telefono text,
  ciudad text,
  linkedin text,
  experiencia integer NOT NULL DEFAULT 0,
  cv_url text,
  video_url text,
  skills text[] NOT NULL DEFAULT '{}'::text[],
  evaluation_id uuid REFERENCES public.evaluations(id) ON DELETE SET NULL,
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  accepted_privacy_policy boolean NOT NULL DEFAULT false,
  privacy_policy_accepted_at timestamptz,
  privacy_policy_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, nombre)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- =========================================================
-- APPLICATIONS: link to user + reused evaluation
-- =========================================================
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evaluation_id uuid REFERENCES public.evaluations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS applications_user_id_idx ON public.applications(user_id);

-- Allow candidate_id to be NULL now that profiles are the source of truth
ALTER TABLE public.applications ALTER COLUMN candidate_id DROP NOT NULL;

DROP POLICY IF EXISTS "Users can view own applications" ON public.applications;
CREATE POLICY "Users can view own applications" ON public.applications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own applications" ON public.applications;
CREATE POLICY "Users can create own applications" ON public.applications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND vacancy_id IS NOT NULL);

-- =========================================================
-- EVALUATIONS: link to user + read own
-- =========================================================
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS evaluations_user_id_idx ON public.evaluations(user_id);

DROP POLICY IF EXISTS "Users can view own evaluations" ON public.evaluations;
CREATE POLICY "Users can view own evaluations" ON public.evaluations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own evaluation answers" ON public.evaluation_answers;
CREATE POLICY "Users can view own evaluation answers" ON public.evaluation_answers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_id AND e.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view own evaluation results" ON public.evaluation_results;
CREATE POLICY "Users can view own evaluation results" ON public.evaluation_results
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_id AND e.user_id = auth.uid()));

-- =========================================================
-- apply_to_vacancy RPC: profile-aware, reuses evaluations
-- =========================================================
CREATE OR REPLACE FUNCTION public.apply_to_vacancy(_vacancy_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _profile public.profiles%ROWTYPE;
  _existing_app_id uuid;
  _existing_eval_id uuid;
  _reused_eval_id uuid;
  _application_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _vacancy_id IS NULL THEN RAISE EXCEPTION 'vacancy_required'; END IF;

  SELECT * INTO _profile FROM public.profiles WHERE user_id = _uid;
  IF _profile.user_id IS NULL THEN RAISE EXCEPTION 'profile_missing'; END IF;

  IF COALESCE(_profile.nombre,'') = ''
     OR COALESCE(_profile.telefono,'') = ''
     OR COALESCE(_profile.ciudad,'') = ''
     OR COALESCE(_profile.cv_url,'') = ''
     OR NOT _profile.accepted_privacy_policy THEN
    RAISE EXCEPTION 'profile_incomplete';
  END IF;

  -- Already applied?
  SELECT id, evaluation_id INTO _existing_app_id, _reused_eval_id
  FROM public.applications
  WHERE user_id = _uid AND vacancy_id = _vacancy_id
  ORDER BY created_at DESC LIMIT 1;

  IF _existing_app_id IS NOT NULL THEN
    -- If it has an evaluation, return it
    IF _reused_eval_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'application_id', _existing_app_id,
        'evaluation_id', _reused_eval_id,
        'reused', true,
        'completed', (SELECT status = 'completed' FROM public.evaluations WHERE id = _reused_eval_id)
      );
    END IF;
  END IF;

  -- Reuse most recent completed evaluation for this user
  SELECT id INTO _reused_eval_id
  FROM public.evaluations
  WHERE user_id = _uid AND status = 'completed'
  ORDER BY finished_at DESC NULLS LAST, updated_at DESC
  LIMIT 1;

  IF _reused_eval_id IS NULL THEN
    -- Start a fresh evaluation tied to the user
    INSERT INTO public.evaluations (candidate_id, vacancy_id, user_id)
    VALUES (_profile.candidate_id, _vacancy_id, _uid)
    RETURNING id INTO _reused_eval_id;
  END IF;

  IF _existing_app_id IS NULL THEN
    INSERT INTO public.applications (user_id, candidate_id, vacancy_id, evaluation_id, respuestas)
    VALUES (_uid, _profile.candidate_id, _vacancy_id, _reused_eval_id, '{}'::jsonb)
    RETURNING id INTO _application_id;
  ELSE
    UPDATE public.applications SET evaluation_id = _reused_eval_id, updated_at = now()
    WHERE id = _existing_app_id
    RETURNING id INTO _application_id;
  END IF;

  RETURN jsonb_build_object(
    'application_id', _application_id,
    'evaluation_id', _reused_eval_id,
    'reused', (SELECT status = 'completed' FROM public.evaluations WHERE id = _reused_eval_id),
    'completed', (SELECT status = 'completed' FROM public.evaluations WHERE id = _reused_eval_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_to_vacancy(uuid) TO authenticated;

-- After finalize, cache eval on profile so future applies reuse it
CREATE OR REPLACE FUNCTION public.cache_evaluation_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.user_id IS NOT NULL THEN
    UPDATE public.profiles SET evaluation_id = NEW.id, updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evaluations_cache_on_profile ON public.evaluations;
CREATE TRIGGER evaluations_cache_on_profile
  AFTER UPDATE OF status ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.cache_evaluation_on_profile();

-- Storage: allow authenticated users to manage files under their user_id folder in "applications"
DROP POLICY IF EXISTS "Authenticated can upload own application files" ON storage.objects;
CREATE POLICY "Authenticated can upload own application files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'applications' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Authenticated can read own application files" ON storage.objects;
CREATE POLICY "Authenticated can read own application files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'applications' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Authenticated can update own application files" ON storage.objects;
CREATE POLICY "Authenticated can update own application files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'applications' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'applications' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Authenticated can delete own application files" ON storage.objects;
CREATE POLICY "Authenticated can delete own application files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'applications' AND (storage.foldername(name))[1] = auth.uid()::text);
