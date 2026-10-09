REVOKE EXECUTE ON FUNCTION public.apply_to_vacancy(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_to_vacancy(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_to_vacancy(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_to_vacancy(uuid) TO service_role;