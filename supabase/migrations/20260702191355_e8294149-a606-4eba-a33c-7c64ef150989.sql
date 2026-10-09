
-- Ensure RLS is on
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

-- Ensure Data API grants (public application flow needs anon INSERT)
GRANT INSERT ON public.candidates TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;

GRANT INSERT ON public.applications TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;

GRANT INSERT ON public.uploads TO anon, authenticated;
GRANT SELECT ON public.uploads TO authenticated;
GRANT ALL ON public.uploads TO service_role;

-- Recreate INSERT policies cleanly with explicit WITH CHECK + TO roles
DROP POLICY IF EXISTS "anyone can apply" ON public.candidates;
CREATE POLICY "Public can submit candidate applications"
  ON public.candidates
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "anyone can create application" ON public.applications;
CREATE POLICY "Public can submit applications"
  ON public.applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "anyone can insert uploads" ON public.uploads;
CREATE POLICY "Public can submit uploads"
  ON public.uploads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
