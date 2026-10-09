
CREATE OR REPLACE FUNCTION public.grant_admin_to_jesus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = 'jesus.anaya@tumomento.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_jesus ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_jesus
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_to_jesus();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_jesus ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_grant_jesus
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_admin_to_jesus();
