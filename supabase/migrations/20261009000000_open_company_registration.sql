-- Run once in Supabase SQL Editor before using open company registration.
-- Each recruiter owns their vacancies. Existing unowned vacancies stay admin-managed.
BEGIN;

ALTER TABLE public.vacancies ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.vacancies ALTER COLUMN created_by SET DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS vacancies_created_by_idx ON public.vacancies(created_by);
GRANT INSERT, UPDATE, DELETE ON public.vacancies TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_vacancy(_vacancy_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR (
    public.has_role(auth.uid(), 'recruiter') AND EXISTS (
      SELECT 1 FROM public.vacancies WHERE id = _vacancy_id AND created_by = auth.uid()
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_applicant(_user_id uuid, _candidate_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR (
    public.has_role(auth.uid(), 'recruiter') AND EXISTS (
      SELECT 1 FROM public.applications a JOIN public.vacancies v ON v.id = a.vacancy_id
      WHERE v.created_by = auth.uid()
        AND ((_user_id IS NOT NULL AND a.user_id = _user_id)
          OR (_candidate_id IS NOT NULL AND a.candidate_id = _candidate_id))
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_company_evaluation(_evaluation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.evaluations e WHERE e.id = _evaluation_id
      AND (e.user_id = auth.uid() OR public.can_manage_vacancy(e.vacancy_id))
  ) OR EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.evaluation_id = _evaluation_id AND public.can_manage_vacancy(a.vacancy_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_company_file(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (p.cv_url = _name OR p.video_url = _name)
      AND (p.user_id = auth.uid() OR public.can_read_applicant(p.user_id, p.candidate_id))
  ) OR EXISTS (
    SELECT 1 FROM public.uploads u
    WHERE (u.cv_url = _name OR u.video_url = _name)
      AND public.can_read_applicant(NULL, u.candidate_id)
  ) OR split_part(_name, '/', 1) = auth.uid()::text;
$$;

REVOKE ALL ON FUNCTION public.can_manage_vacancy(uuid), public.can_read_applicant(uuid, uuid),
  public.can_read_company_evaluation(uuid), public.can_read_company_file(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_vacancy(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_applicant(uuid, uuid),
  public.can_read_company_evaluation(uuid), public.can_read_company_file(text) TO authenticated;

DROP POLICY IF EXISTS "recruiters manage own vacancies" ON public.vacancies;
CREATE POLICY "recruiters manage own vacancies" ON public.vacancies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'recruiter') AND created_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'recruiter') AND created_by = auth.uid());
DROP POLICY IF EXISTS "anyone reads active vacancies" ON public.vacancies;
CREATE POLICY "anyone reads active vacancies" ON public.vacancies FOR SELECT TO anon, authenticated
  USING (is_active OR public.can_manage_vacancy(id));

-- Restrictive policies also constrain existing permissive recruiter policies.
DROP POLICY IF EXISTS "company application read scope" ON public.applications;
CREATE POLICY "company application read scope" ON public.applications AS RESTRICTIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_vacancy(vacancy_id));
DROP POLICY IF EXISTS "company application update scope" ON public.applications;
CREATE POLICY "company application update scope" ON public.applications AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.can_manage_vacancy(vacancy_id)) WITH CHECK (public.can_manage_vacancy(vacancy_id));
DROP POLICY IF EXISTS "company candidate scope" ON public.candidates;
CREATE POLICY "company candidate scope" ON public.candidates AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_read_applicant(NULL, id));
DROP POLICY IF EXISTS "company upload scope" ON public.uploads;
CREATE POLICY "company upload scope" ON public.uploads AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_read_applicant(NULL, candidate_id));
DROP POLICY IF EXISTS "company evaluation scope" ON public.evaluations;
CREATE POLICY "company evaluation scope" ON public.evaluations AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_read_company_evaluation(id));
DROP POLICY IF EXISTS "company result scope" ON public.evaluation_results;
CREATE POLICY "company result scope" ON public.evaluation_results AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_read_company_evaluation(evaluation_id));
DROP POLICY IF EXISTS "company answer scope" ON public.evaluation_answers;
CREATE POLICY "company answer scope" ON public.evaluation_answers AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_read_company_evaluation(evaluation_id));
DROP POLICY IF EXISTS "company question scope" ON public.questions;
CREATE POLICY "company question scope" ON public.questions AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_manage_vacancy(vacancy_id));
DROP POLICY IF EXISTS "company applicant profiles" ON public.profiles;
CREATE POLICY "company applicant profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.can_read_applicant(user_id, candidate_id));
DROP POLICY IF EXISTS "company profile scope" ON public.profiles;
CREATE POLICY "company profile scope" ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_read_applicant(user_id, candidate_id));
DROP POLICY IF EXISTS "company application file scope" ON storage.objects;
CREATE POLICY "company application file scope" ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
  USING (bucket_id <> 'applications' OR public.can_read_company_file(name));

-- A recruiter can change the pipeline status, never the applicant or vacancy identity.
CREATE OR REPLACE FUNCTION public.protect_application_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Trusted SECURITY DEFINER application RPCs run as their database owner.
  IF current_user IN ('authenticated', 'anon') AND auth.uid() IS NOT NULL
    AND NOT public.has_role(auth.uid(), 'admin') AND (
    NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.candidate_id IS DISTINCT FROM OLD.candidate_id
    OR NEW.vacancy_id IS DISTINCT FROM OLD.vacancy_id OR NEW.evaluation_id IS DISTINCT FROM OLD.evaluation_id
    OR NEW.respuestas IS DISTINCT FROM OLD.respuestas
  ) THEN RAISE EXCEPTION 'Only an administrator can change an application identity'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_application_identity ON public.applications;
CREATE TRIGGER protect_application_identity BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.protect_application_identity();

CREATE OR REPLACE FUNCTION public.register_company_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'role' = 'company' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'recruiter')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.register_company_account() FROM PUBLIC;
DROP TRIGGER IF EXISTS register_company_account ON auth.users;
CREATE TRIGGER register_company_account AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.register_company_account();

-- Activate company accounts registered before this migration without granting admin.
INSERT INTO public.user_roles(user_id, role)
SELECT id, 'recruiter'::public.app_role FROM auth.users WHERE raw_user_meta_data->>'role' = 'company'
ON CONFLICT (user_id, role) DO NOTHING;

COMMIT;
