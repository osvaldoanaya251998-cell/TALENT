DROP POLICY IF EXISTS "Public can submit candidate applications" ON public.candidates;
CREATE POLICY "Public can submit candidate applications"
ON public.candidates
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(nombre)) >= 2
  AND length(trim(email)) >= 5
  AND email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  AND length(trim(telefono)) >= 7
  AND length(trim(ciudad)) >= 2
  AND experiencia >= 0
  AND experiencia <= 60
);

DROP POLICY IF EXISTS "Public can submit applications" ON public.applications;
CREATE POLICY "Public can submit applications"
ON public.applications
FOR INSERT
TO anon, authenticated
WITH CHECK (
  candidate_id IS NOT NULL
  AND jsonb_typeof(respuestas) = 'object'
  AND status = 'nuevo'::application_status
);

DROP POLICY IF EXISTS "Public can submit uploads" ON public.uploads;
CREATE POLICY "Public can submit uploads"
ON public.uploads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  candidate_id IS NOT NULL
  AND cv_url IS NOT NULL
  AND length(trim(cv_url)) > 0
  AND (video_url IS NULL OR length(trim(video_url)) > 0)
);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.grant_admin_to_jesus() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_admin_to_jesus() FROM anon;
REVOKE EXECUTE ON FUNCTION public.grant_admin_to_jesus() FROM authenticated;