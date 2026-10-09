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
  _reused_eval_id uuid;
  _application_id uuid;
  _candidate_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _vacancy_id IS NULL THEN RAISE EXCEPTION 'vacancy_required'; END IF;

  SELECT * INTO _profile FROM public.profiles WHERE user_id = _uid;
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

  SELECT id, evaluation_id INTO _existing_app_id, _reused_eval_id
  FROM public.applications
  WHERE user_id = _uid AND vacancy_id = _vacancy_id
  ORDER BY created_at DESC LIMIT 1;

  IF _existing_app_id IS NOT NULL AND _reused_eval_id IS NOT NULL THEN
    UPDATE public.applications
    SET candidate_id = _candidate_id, updated_at = now()
    WHERE id = _existing_app_id AND candidate_id IS NULL;

    UPDATE public.evaluations
    SET candidate_id = COALESCE(candidate_id, _candidate_id),
        user_id = COALESCE(user_id, _uid),
        vacancy_id = COALESCE(vacancy_id, _vacancy_id),
        application_id = COALESCE(application_id, _existing_app_id),
        updated_at = now()
    WHERE id = _reused_eval_id;

    RETURN jsonb_build_object(
      'application_id', _existing_app_id,
      'evaluation_id', _reused_eval_id,
      'reused', true,
      'completed', (SELECT status = 'completed' FROM public.evaluations WHERE id = _reused_eval_id)
    );
  END IF;

  SELECT id INTO _reused_eval_id
  FROM public.evaluations
  WHERE user_id = _uid AND status = 'completed'
  ORDER BY finished_at DESC NULLS LAST, updated_at DESC
  LIMIT 1;

  IF _reused_eval_id IS NULL THEN
    INSERT INTO public.evaluations (candidate_id, vacancy_id, user_id)
    VALUES (_candidate_id, _vacancy_id, _uid)
    RETURNING id INTO _reused_eval_id;
  ELSE
    UPDATE public.evaluations
    SET candidate_id = COALESCE(candidate_id, _candidate_id),
        vacancy_id = COALESCE(vacancy_id, _vacancy_id),
        user_id = COALESCE(user_id, _uid),
        updated_at = now()
    WHERE id = _reused_eval_id;
  END IF;

  IF _existing_app_id IS NULL THEN
    INSERT INTO public.applications (user_id, candidate_id, vacancy_id, evaluation_id, respuestas)
    VALUES (_uid, _candidate_id, _vacancy_id, _reused_eval_id, '{}'::jsonb)
    RETURNING id INTO _application_id;
  ELSE
    UPDATE public.applications
    SET candidate_id = _candidate_id, evaluation_id = _reused_eval_id, updated_at = now()
    WHERE id = _existing_app_id
    RETURNING id INTO _application_id;
  END IF;

  UPDATE public.evaluations
  SET application_id = COALESCE(application_id, _application_id), updated_at = now()
  WHERE id = _reused_eval_id;

  RETURN jsonb_build_object(
    'application_id', _application_id,
    'evaluation_id', _reused_eval_id,
    'reused', (SELECT status = 'completed' FROM public.evaluations WHERE id = _reused_eval_id),
    'completed', (SELECT status = 'completed' FROM public.evaluations WHERE id = _reused_eval_id)
  );
END;
$function$;

DO $$
DECLARE
  rec record;
  new_candidate_id uuid;
BEGIN
  FOR rec IN
    SELECT a.id AS application_id, a.user_id, a.vacancy_id, a.evaluation_id,
           p.nombre, p.email, p.telefono, p.ciudad, p.linkedin, p.experiencia,
           p.cv_url, p.video_url, p.accepted_privacy_policy,
           p.privacy_policy_accepted_at, p.privacy_policy_version, p.candidate_id
    FROM public.applications a
    JOIN public.profiles p ON p.user_id = a.user_id
    WHERE a.candidate_id IS NULL
      AND COALESCE(p.nombre, '') <> ''
      AND COALESCE(p.email, '') <> ''
      AND COALESCE(p.telefono, '') <> ''
      AND COALESCE(p.ciudad, '') <> ''
  LOOP
    new_candidate_id := rec.candidate_id;

    IF new_candidate_id IS NULL THEN
      INSERT INTO public.candidates (
        nombre, email, telefono, ciudad, linkedin, experiencia,
        accepted_privacy_policy, privacy_policy_accepted_at, privacy_policy_version
      ) VALUES (
        rec.nombre, rec.email, rec.telefono, rec.ciudad, rec.linkedin,
        COALESCE(rec.experiencia, 0), COALESCE(rec.accepted_privacy_policy, false),
        rec.privacy_policy_accepted_at, rec.privacy_policy_version
      )
      RETURNING id INTO new_candidate_id;

      UPDATE public.profiles
      SET candidate_id = new_candidate_id, updated_at = now()
      WHERE user_id = rec.user_id;
    END IF;

    UPDATE public.applications
    SET candidate_id = new_candidate_id, updated_at = now()
    WHERE id = rec.application_id;

    IF rec.evaluation_id IS NOT NULL THEN
      UPDATE public.evaluations
      SET candidate_id = COALESCE(candidate_id, new_candidate_id),
          user_id = COALESCE(user_id, rec.user_id),
          vacancy_id = COALESCE(vacancy_id, rec.vacancy_id),
          application_id = COALESCE(application_id, rec.application_id),
          updated_at = now()
      WHERE id = rec.evaluation_id;
    END IF;

    IF COALESCE(rec.cv_url, '') <> '' OR COALESCE(rec.video_url, '') <> '' THEN
      UPDATE public.uploads
      SET cv_url = COALESCE(rec.cv_url, cv_url),
          video_url = COALESCE(rec.video_url, video_url)
      WHERE candidate_id = new_candidate_id;

      IF NOT FOUND THEN
        INSERT INTO public.uploads (candidate_id, cv_url, video_url)
        VALUES (new_candidate_id, rec.cv_url, rec.video_url);
      END IF;
    END IF;
  END LOOP;
END $$;