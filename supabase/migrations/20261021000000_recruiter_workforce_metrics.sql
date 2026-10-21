BEGIN;
CREATE TABLE IF NOT EXISTS public.recruiter_workforce_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  month date NOT NULL CHECK (month = date_trunc('month', month)::date),
  headcount_start integer NOT NULL CHECK (headcount_start BETWEEN 0 AND 10000000),
  hires integer NOT NULL CHECK (hires BETWEEN 0 AND 10000000),
  departures integer NOT NULL CHECK (departures BETWEEN 0 AND 10000000),
  headcount_end integer GENERATED ALWAYS AS (headcount_start + hires - departures) STORED,
  target_percent numeric(7,2) CHECK (target_percent IS NULL OR target_percent BETWEEN 0 AND 10000),
  notes text CHECK (char_length(COALESCE(notes, '')) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, month),
  CHECK (headcount_end >= 0)
);
ALTER TABLE public.recruiter_workforce_periods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recruiter_workforce_periods FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.recruiter_workforce_periods TO authenticated;
GRANT ALL ON public.recruiter_workforce_periods TO service_role;
DROP POLICY IF EXISTS "owner reads workforce periods" ON public.recruiter_workforce_periods;
CREATE POLICY "owner reads workforce periods" ON public.recruiter_workforce_periods FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND (public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin')));
DROP POLICY IF EXISTS "owner inserts workforce periods" ON public.recruiter_workforce_periods;
CREATE POLICY "owner inserts workforce periods" ON public.recruiter_workforce_periods FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND (public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin')));
DROP POLICY IF EXISTS "owner updates workforce periods" ON public.recruiter_workforce_periods;
CREATE POLICY "owner updates workforce periods" ON public.recruiter_workforce_periods FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND (public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin')))
  WITH CHECK (owner_id = auth.uid() AND (public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin')));
DROP TRIGGER IF EXISTS workforce_periods_updated ON public.recruiter_workforce_periods;
CREATE TRIGGER workforce_periods_updated BEFORE UPDATE ON public.recruiter_workforce_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
NOTIFY pgrst, 'reload schema';
COMMIT;
