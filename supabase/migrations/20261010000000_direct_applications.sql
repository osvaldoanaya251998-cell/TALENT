-- Postulaciones directas sin crear evaluaciones. Conserva los datos anteriores.
BEGIN;
CREATE OR REPLACE FUNCTION public.apply_to_vacancy(_vacancy_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _profile public.profiles%ROWTYPE;
  _existing_app_id uuid;
  _application_id uuid;
  _candidate_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _vacancy_id IS NULL THEN RAISE EXCEPTION 'vacancy_required'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.vacancies WHERE id = _vacancy_id AND is_active) THEN
    RAISE EXCEPTION 'vacancy_unavailable';
  END IF;

  -- Lock the profile so repeated submissions by the same user cannot duplicate applications.
  SELECT * INTO _profile FROM public.profiles WHERE user_id = _uid FOR UPDATE;
  IF _profile.user_id IS NULL THEN RAISE EXCEPTION 'profile_missing'; END IF;

  IF COALESCE(_profile.nombre,'') = ''
     OR COALESCE(_profile.email,'') = ''
     OR COALESCE(_profile.telefono,'') = ''
     OR COALESCE(_profile.ciudad,'') = ''
     OR COALESCE(_profile.cv_url,'') = ''
     OR NOT _profile.accepted_privacy_policy THEN
    RAISE EXCEPTION 'profile_incomplete';
  END IF;

  _candidate_id := _profile.candidate_id;

  IF _candidate_id IS NULL THEN
    INSERT INTO public.candidates (
      nombre, email, telefono, ciudad, linkedin, experiencia,
      accepted_privacy_policy, privacy_policy_accepted_at, privacy_policy_version
    ) VALUES (
      COALESCE(_profile.nombre, ''),
      COALESCE(_profile.email, ''),
      COALESCE(_profile.telefono, ''),
      COALESCE(_profile.ciudad, ''),
      _profile.linkedin,
      COALESCE(_profile.experiencia, 0),
      COALESCE(_profile.accepted_privacy_policy, false),
      _profile.privacy_policy_accepted_at,
      _profile.privacy_policy_version
    )
    RETURNING id INTO _candidate_id;

    UPDATE public.profiles
    SET candidate_id = _candidate_id, updated_at = now()
    WHERE user_id = _uid;
  ELSE
    UPDATE public.candidates
    SET nombre = COALESCE(_profile.nombre, nombre),
        email = COALESCE(_profile.email, email),
        telefono = COALESCE(_profile.telefono, telefono),
        ciudad = COALESCE(_profile.ciudad, ciudad),
        linkedin = _profile.linkedin,
        experiencia = COALESCE(_profile.experiencia, experiencia),
        accepted_privacy_policy = COALESCE(_profile.accepted_privacy_policy, accepted_privacy_policy),
        privacy_policy_accepted_at = COALESCE(_profile.privacy_policy_accepted_at, privacy_policy_accepted_at),
        privacy_policy_version = COALESCE(_profile.privacy_policy_version, privacy_policy_version)
    WHERE id = _candidate_id;
  END IF;

  IF COALESCE(_profile.cv_url, '') <> '' OR COALESCE(_profile.video_url, '') <> '' THEN
    UPDATE public.uploads
    SET cv_url = COALESCE(_profile.cv_url, cv_url),
        video_url = COALESCE(_profile.video_url, video_url)
    WHERE candidate_id = _candidate_id;

    IF NOT FOUND THEN
      INSERT INTO public.uploads (candidate_id, cv_url, video_url)
      VALUES (_candidate_id, _profile.cv_url, _profile.video_url);
    END IF;
  END IF;

  SELECT id INTO _existing_app_id FROM public.applications
  WHERE user_id = _uid AND vacancy_id = _vacancy_id
  ORDER BY created_at DESC LIMIT 1;

  IF _existing_app_id IS NOT NULL THEN
    RETURN jsonb_build_object('application_id', _existing_app_id, 'reused', true);
  END IF;

  INSERT INTO public.applications (user_id, candidate_id, vacancy_id, respuestas)
  VALUES (_uid, _candidate_id, _vacancy_id, '{}'::jsonb)
  RETURNING id INTO _application_id;

  RETURN jsonb_build_object('application_id', _application_id, 'reused', false);
END;
$function$;
REVOKE ALL ON FUNCTION public.apply_to_vacancy(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_to_vacancy(uuid) TO authenticated;

COMMIT;
