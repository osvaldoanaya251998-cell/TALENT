
-- Trigger and helper functions do NOT need to be executable via the API.
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_admin_to_jesus() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Admin-only maintenance function: finalize_evaluation still needs to be called
-- by anon (the candidate finishes their own exam), but restrict the rest.
-- All *evaluation* RPCs validate state internally (status='in_progress'), so
-- keeping them callable by anon is required by the anonymous candidate flow.
