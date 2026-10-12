-- Cola privada: solo nuevas postulaciones. No envía correos desde la transacción.
BEGIN;

CREATE TABLE IF NOT EXISTS public.application_email_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL UNIQUE REFERENCES public.applications(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'needs_review')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  lease_token uuid,
  provider_message_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS application_email_notifications_pending_idx
  ON public.application_email_notifications(next_attempt_at) WHERE status = 'pending';
ALTER TABLE public.application_email_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.application_email_notifications FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.application_email_notifications TO service_role;

CREATE TABLE IF NOT EXISTS public.application_email_daily_usage (
  day date PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 100)
);
ALTER TABLE public.application_email_daily_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.application_email_daily_usage FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.application_email_daily_usage TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_application_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.vacancy_id IS NOT NULL THEN
    INSERT INTO public.application_email_notifications(application_id)
    VALUES (NEW.id) ON CONFLICT (application_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_application_email() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS applications_enqueue_email ON public.applications;
CREATE TRIGGER applications_enqueue_email AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_application_email();

CREATE OR REPLACE FUNCTION public.claim_application_emails()
RETURNS TABLE (
  notification_id uuid, lease_token uuid, application_id uuid, vacancy_id uuid,
  recruiter_email text, vacancy_title text, candidate_name text,
  candidate_phone text, candidate_email text, attempts integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _day date := (now() AT TIME ZONE 'UTC')::date;
  _used integer;
  _claimed integer;
BEGIN
  -- A crashed delivery can have been accepted by the provider. Do not resend blindly.
  UPDATE public.application_email_notifications n
  SET status = 'needs_review', last_error = 'delivery_confirmation_unknown',
      lease_token = NULL, locked_until = NULL
  WHERE n.status = 'processing' AND n.locked_until < now();

  UPDATE public.application_email_notifications n
  SET status = 'needs_review', last_error = 'recruiter_unavailable'
  WHERE n.status = 'pending' AND NOT EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.vacancies v ON v.id = a.vacancy_id
    JOIN auth.users u ON u.id = v.created_by
    WHERE a.id = n.application_id AND u.email IS NOT NULL AND u.email_confirmed_at IS NOT NULL
      AND (public.has_role(u.id, 'recruiter') OR public.has_role(u.id, 'admin'))
  );

  -- Lock this counter before claiming: concurrent cron runs share the same cap.
  INSERT INTO public.application_email_daily_usage(day) VALUES (_day) ON CONFLICT DO NOTHING;
  SELECT d.attempts INTO _used FROM public.application_email_daily_usage d WHERE d.day = _day FOR UPDATE;
  IF _used >= 100 THEN RETURN; END IF;

  RETURN QUERY
  WITH eligible AS (
    SELECT n.id FROM public.application_email_notifications n
    WHERE n.status = 'pending' AND n.next_attempt_at <= now()
    ORDER BY n.created_at, n.id LIMIT LEAST(5, 100 - _used)
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.application_email_notifications n
    SET status = 'processing', locked_until = now() + interval '5 minutes',
        lease_token = gen_random_uuid(), attempts = n.attempts + 1
    FROM eligible e WHERE n.id = e.id
    RETURNING n.id, n.lease_token, n.application_id, n.attempts
  )
  SELECT n.id, n.lease_token, a.id, a.vacancy_id, u.email::text, v.title::text,
         COALESCE(NULLIF(p.nombre, ''), c.nombre, 'Candidato')::text,
         COALESCE(NULLIF(p.telefono, ''), c.telefono, '')::text,
         COALESCE(NULLIF(p.email, ''), c.email, '')::text, n.attempts
  FROM claimed n
  JOIN public.applications a ON a.id = n.application_id
  JOIN public.vacancies v ON v.id = a.vacancy_id
  JOIN auth.users u ON u.id = v.created_by
  LEFT JOIN public.profiles p ON p.user_id = a.user_id
  LEFT JOIN public.candidates c ON c.id = a.candidate_id;
  GET DIAGNOSTICS _claimed = ROW_COUNT;
  UPDATE public.application_email_daily_usage d SET attempts = d.attempts + _claimed WHERE d.day = _day;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_application_email(
  _notification_id uuid, _lease_token uuid, _provider_message_id text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.application_email_notifications n
  SET status = 'sent', sent_at = now(), provider_message_id = left(_provider_message_id, 500),
      locked_until = NULL, lease_token = NULL, last_error = NULL
  WHERE n.id = _notification_id AND n.lease_token = _lease_token AND n.status = 'processing';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.retry_application_email(
  _notification_id uuid, _lease_token uuid, _error text, _retry_seconds integer,
  _needs_review boolean DEFAULT false
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.application_email_notifications n
  SET status = CASE WHEN _needs_review THEN 'needs_review' ELSE 'pending' END,
      next_attempt_at = now() + make_interval(secs => GREATEST(60, LEAST(COALESCE(_retry_seconds, 60), 86400))),
      last_error = left(regexp_replace(COALESCE(_error, 'delivery_error'), '[^a-z0-9_]', '', 'g'), 80),
      lease_token = NULL, locked_until = NULL
  WHERE n.id = _notification_id AND n.lease_token = _lease_token AND n.status = 'processing';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_application_emails() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_application_email(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retry_application_email(uuid, uuid, text, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_application_emails() TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_application_email(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.retry_application_email(uuid, uuid, text, integer, boolean) TO service_role;

COMMIT;
