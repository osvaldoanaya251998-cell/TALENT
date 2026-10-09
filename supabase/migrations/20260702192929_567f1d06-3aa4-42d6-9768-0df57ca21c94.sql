ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.candidates TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;

GRANT INSERT ON public.applications TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;

GRANT INSERT ON public.uploads TO anon, authenticated;
GRANT SELECT ON public.uploads TO authenticated;
GRANT ALL ON public.uploads TO service_role;

DROP POLICY IF EXISTS "Public can submit candidate applications" ON public.candidates;
CREATE POLICY "Public can submit candidate applications"
ON public.candidates
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "admins read candidates" ON public.candidates;
CREATE POLICY "admins read candidates"
ON public.candidates
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admins update candidates" ON public.candidates;
CREATE POLICY "admins update candidates"
ON public.candidates
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admins delete candidates" ON public.candidates;
CREATE POLICY "admins delete candidates"
ON public.candidates
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Public can submit applications" ON public.applications;
CREATE POLICY "Public can submit applications"
ON public.applications
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can submit uploads" ON public.uploads;
CREATE POLICY "Public can submit uploads"
ON public.uploads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);