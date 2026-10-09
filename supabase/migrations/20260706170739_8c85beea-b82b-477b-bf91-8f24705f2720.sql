ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS accepted_privacy_policy boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy_policy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_policy_version text;