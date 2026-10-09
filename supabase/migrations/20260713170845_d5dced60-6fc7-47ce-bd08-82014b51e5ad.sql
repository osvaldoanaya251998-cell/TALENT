
ALTER TABLE public.evaluations ALTER COLUMN candidate_id DROP NOT NULL;

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
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _vacancy_id IS NULL THEN RAISE EXCEPTION 'vacancy_required'; END IF;

  SELECT * INTO _profile FROM public.profiles WHERE user_id = _uid;
  IF _profile.user_id IS NULL THEN RAISE EXCEPTION 'profile_missing'; END IF;

  IF COALESCE(_profile.nombre,'') = ''
     OR COALESCE(_profile.telefono,'') = ''
     OR COALESCE(_profile.ciudad,'') = ''
     OR COALESCE(_profile.cv_url,'') = ''
     OR NOT _profile.accepted_privacy_policy THEN
    RAISE EXCEPTION 'profile_incomplete';
  END IF;

  SELECT id, evaluation_id INTO _existing_app_id, _reused_eval_id
  FROM public.applications
  WHERE user_id = _uid AND vacancy_id = _vacancy_id
  ORDER BY created_at DESC LIMIT 1;

  IF _existing_app_id IS NOT NULL AND _reused_eval_id IS NOT NULL THEN
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
    VALUES (_profile.candidate_id, _vacancy_id, _uid)
    RETURNING id INTO _reused_eval_id;
  END IF;

  IF _existing_app_id IS NULL THEN
    INSERT INTO public.applications (user_id, candidate_id, vacancy_id, evaluation_id, respuestas)
    VALUES (_uid, _profile.candidate_id, _vacancy_id, _reused_eval_id, '{}'::jsonb)
    RETURNING id INTO _application_id;
  ELSE
    UPDATE public.applications SET evaluation_id = _reused_eval_id, updated_at = now()
    WHERE id = _existing_app_id
    RETURNING id INTO _application_id;
  END IF;

  RETURN jsonb_build_object(
    'application_id', _application_id,
    'evaluation_id', _reused_eval_id,
    'reused', (SELECT status = 'completed' FROM public.evaluations WHERE id = _reused_eval_id),
    'completed', (SELECT status = 'completed' FROM public.evaluations WHERE id = _reused_eval_id)
  );
END;
$function$;
