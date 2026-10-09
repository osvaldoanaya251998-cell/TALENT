
-- Fix: EXISTS subqueries against public.candidates in WITH CHECK policies fail for anon
-- because anon lacks SELECT on candidates. FK constraints already guarantee existence.

DROP POLICY IF EXISTS "Public can submit applications" ON public.applications;
CREATE POLICY "Public can submit applications" ON public.applications
FOR INSERT TO anon, authenticated
WITH CHECK (
  candidate_id IS NOT NULL
  AND vacancy_id IS NOT NULL
  AND jsonb_typeof(respuestas) = 'object'
  AND status = 'nuevo'::application_status
  AND EXISTS (SELECT 1 FROM public.vacancies v WHERE v.id = applications.vacancy_id AND v.is_active = true)
);

DROP POLICY IF EXISTS "Public can submit uploads" ON public.uploads;
CREATE POLICY "Public can submit uploads" ON public.uploads
FOR INSERT TO anon, authenticated
WITH CHECK (
  candidate_id IS NOT NULL
  AND cv_url IS NOT NULL
  AND length(trim(cv_url)) > 0
  AND cv_url LIKE (candidate_id::text || '/%')
  AND (video_url IS NULL OR video_url LIKE (candidate_id::text || '/%'))
);

-- Also allow anon to read active vacancies through the subquery (needed by applications policy)
-- The existing vacancies SELECT policy already permits anon to read active rows, so the
-- EXISTS on vacancies works. Nothing more to change there.

-- Storage: same EXISTS-on-candidates issue for the upload policy.
DROP POLICY IF EXISTS "candidate uploads to own folder" ON storage.objects;
CREATE POLICY "candidate uploads to own folder" ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'applications'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);
