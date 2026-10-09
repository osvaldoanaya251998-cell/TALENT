ALTER TABLE public.vacancies
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS ramos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pay_scheme text,
  ADD COLUMN IF NOT EXISTS salary_text text,
  ADD COLUMN IF NOT EXISTS cedula text NOT NULL DEFAULT 'No requiere',
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS modality public.aj_modality,
  ADD COLUMN IF NOT EXISTS requirements text,
  ADD COLUMN IF NOT EXISTS benefits text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'activa',
  ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS resumen text,
  ADD COLUMN IF NOT EXISTS ramos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS certificaciones text[] NOT NULL DEFAULT '{}';
GRANT INSERT, UPDATE ON public.vacancies TO authenticated;
DROP POLICY IF EXISTS "Recruiters manage vacancies" ON public.vacancies;
CREATE POLICY "Recruiters manage vacancies" ON public.vacancies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recruiter'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recruiter'));