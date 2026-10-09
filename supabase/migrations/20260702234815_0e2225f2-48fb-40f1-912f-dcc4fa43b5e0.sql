
-- =========================================================
-- EVALUATIONS
-- =========================================================
DROP POLICY IF EXISTS "evaluations public read" ON public.evaluations;
DROP POLICY IF EXISTS "evaluations public insert" ON public.evaluations;

CREATE POLICY "team read evaluations" ON public.evaluations
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'recruiter'::public.app_role)
  );

REVOKE INSERT, UPDATE, DELETE ON public.evaluations FROM anon;

-- =========================================================
-- EVALUATION_RESULTS
-- =========================================================
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='evaluation_results' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.evaluation_results', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "team read evaluation results" ON public.evaluation_results
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'recruiter'::public.app_role)
  );

CREATE POLICY "admin manages evaluation results" ON public.evaluation_results
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON public.evaluation_results FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_results TO authenticated;
GRANT ALL ON public.evaluation_results TO service_role;

-- =========================================================
-- EVALUATION_ANSWERS
-- =========================================================
DROP POLICY IF EXISTS "eval answers public insert" ON public.evaluation_answers;
DROP POLICY IF EXISTS "eval answers admin read" ON public.evaluation_answers;

CREATE POLICY "team read eval answers" ON public.evaluation_answers
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'recruiter'::public.app_role)
  );

REVOKE INSERT, UPDATE, DELETE ON public.evaluation_answers FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.evaluation_answers FROM authenticated;
GRANT SELECT ON public.evaluation_answers TO authenticated;
GRANT ALL ON public.evaluation_answers TO service_role;

-- =========================================================
-- CANDIDATES
-- =========================================================
DROP POLICY IF EXISTS "admins read candidates" ON public.candidates;
DROP POLICY IF EXISTS "team read candidates" ON public.candidates;
CREATE POLICY "team read candidates" ON public.candidates
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'recruiter'::public.app_role)
  );

-- =========================================================
-- APPLICATIONS
-- =========================================================
DROP POLICY IF EXISTS "Public can submit applications" ON public.applications;
CREATE POLICY "Public can submit applications" ON public.applications
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    candidate_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = candidate_id)
    AND jsonb_typeof(respuestas) = 'object'
    AND status = 'nuevo'::public.application_status
    AND vacancy_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.vacancies v WHERE v.id = vacancy_id AND v.is_active = true)
  );

DROP POLICY IF EXISTS "admins read applications" ON public.applications;
DROP POLICY IF EXISTS "team read applications" ON public.applications;
CREATE POLICY "team read applications" ON public.applications
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'recruiter'::public.app_role)
  );

DROP POLICY IF EXISTS "admins update applications" ON public.applications;
DROP POLICY IF EXISTS "team update applications" ON public.applications;
CREATE POLICY "team update applications" ON public.applications
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'recruiter'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'recruiter'::public.app_role)
  );

-- =========================================================
-- UPLOADS
-- =========================================================
DROP POLICY IF EXISTS "Public can submit uploads" ON public.uploads;
CREATE POLICY "Public can submit uploads" ON public.uploads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    candidate_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = candidate_id)
    AND cv_url IS NOT NULL
    AND length(trim(cv_url)) > 0
    AND cv_url LIKE (candidate_id::text || '/%')
    AND (video_url IS NULL OR video_url LIKE (candidate_id::text || '/%'))
  );

DROP POLICY IF EXISTS "admins read uploads" ON public.uploads;
DROP POLICY IF EXISTS "team read uploads" ON public.uploads;
CREATE POLICY "team read uploads" ON public.uploads
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'recruiter'::public.app_role)
  );

-- =========================================================
-- VACANCIES
-- =========================================================
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='vacancies' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.vacancies', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "anyone reads active vacancies" ON public.vacancies
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'recruiter'::public.app_role)
  );

CREATE POLICY "admin manages vacancies" ON public.vacancies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- =========================================================
-- QUESTIONS: only visible to team; candidates receive via SECURITY DEFINER RPC
-- =========================================================
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='questions' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.questions', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "team reads questions" ON public.questions
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'recruiter'::public.app_role)
  );

CREATE POLICY "admin manages questions" ON public.questions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE SELECT ON public.questions FROM anon;

-- =========================================================
-- STORAGE: restrict uploads to <candidate_uuid>/ folder
-- =========================================================
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname ILIKE '%application%' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "candidate uploads to own folder" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'applications'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "team reads application files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'applications'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'recruiter'::public.app_role)
    )
  );

CREATE POLICY "admin manages application files" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'applications' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'applications' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- =========================================================
-- Helper RPC so the candidate's post-evaluation page can confirm existence
-- without exposing any evaluation data.
-- =========================================================
CREATE OR REPLACE FUNCTION public.evaluation_exists(_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.evaluations WHERE id = _id);
$$;

REVOKE ALL ON FUNCTION public.evaluation_exists(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluation_exists(uuid) TO anon, authenticated;
