
DO $$ BEGIN
  CREATE TYPE public.answer_type AS ENUM ('short_text','long_text','scale_1_5','number','single_choice');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS answer_type public.answer_type NOT NULL DEFAULT 'long_text',
  ALTER COLUMN option_a DROP NOT NULL,
  ALTER COLUMN option_b DROP NOT NULL,
  ALTER COLUMN option_c DROP NOT NULL,
  ALTER COLUMN option_d DROP NOT NULL,
  ALTER COLUMN option_e DROP NOT NULL,
  ALTER COLUMN correct_option DROP NOT NULL;

ALTER TABLE public.evaluation_answers
  ADD COLUMN IF NOT EXISTS answer_text text,
  ALTER COLUMN time_ms DROP NOT NULL,
  ALTER COLUMN time_ms SET DEFAULT 0;

DROP POLICY IF EXISTS "evaluations public insert" ON public.evaluations;
CREATE POLICY "evaluations public insert" ON public.evaluations
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "eval answers public insert" ON public.evaluation_answers;
CREATE POLICY "eval answers public insert" ON public.evaluation_answers
  FOR INSERT TO anon, authenticated WITH CHECK (true);

GRANT INSERT ON public.evaluations TO anon, authenticated;
GRANT INSERT ON public.evaluation_answers TO anon, authenticated;

INSERT INTO public.vacancies (id, title, slug, description, is_active) VALUES
  ('00000000-0000-4000-8000-000000000010','Desarrollo Comercial CDMX','desarrollo-comercial-cdmx','Ejecutivo de Desarrollo Comercial en Ciudad de México.', true),
  ('00000000-0000-4000-8000-000000000011','Desarrollo Comercial Querétaro','desarrollo-comercial-queretaro','Ejecutivo de Desarrollo Comercial en Querétaro.', true),
  ('00000000-0000-4000-8000-000000000012','Desarrollo Comercial Guadalajara','desarrollo-comercial-guadalajara','Ejecutivo de Desarrollo Comercial en Guadalajara.', true),
  ('00000000-0000-4000-8000-000000000013','Líder Territorial Guadalajara','lider-territorial-guadalajara','Líder Territorial para dirigir la operación comercial en Guadalajara.', true)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, slug = EXCLUDED.slug, description = EXCLUDED.description, is_active = true;

UPDATE public.vacancies SET is_active = false WHERE id = '00000000-0000-4000-8000-000000000001';
DELETE FROM public.questions WHERE vacancy_id = '00000000-0000-4000-8000-000000000001' OR vacancy_id IS NULL;

DO $$
DECLARE
  v_ids uuid[] := ARRAY[
    '00000000-0000-4000-8000-000000000010'::uuid,
    '00000000-0000-4000-8000-000000000011'::uuid,
    '00000000-0000-4000-8000-000000000012'::uuid
  ];
  v uuid;
  q_data jsonb := '[
    ["Experiencia","¿Cuántos años de experiencia tienes en ventas o desarrollo comercial?","number"],
    ["Orientación a resultados","¿Has trabajado con metas mensuales de ventas? Cuéntanos cómo.","long_text"],
    ["Orientación a resultados","¿Cuál ha sido el porcentaje más alto de cumplimiento de metas que has alcanzado?","short_text"],
    ["Negociación","Describe una negociación complicada que hayas cerrado exitosamente.","long_text"],
    ["Adaptabilidad","¿Cómo reaccionas cuando un cliente rechaza tu propuesta?","long_text"],
    ["Prospección","¿Qué estrategias utilizas para generar nuevos prospectos?","long_text"],
    ["Organización","¿Qué CRM o herramientas comerciales has utilizado?","short_text"],
    ["Organización","¿Cómo organizas tu agenda y seguimiento de clientes?","long_text"],
    ["Trabajo bajo presión","¿Qué haces cuando no alcanzas tus objetivos de venta?","long_text"],
    ["Negociación","Califica tu habilidad para negociar del 1 al 5.","scale_1_5"],
    ["Comunicación","Califica tu habilidad de comunicación del 1 al 5.","scale_1_5"],
    ["Servicio al cliente","¿Cómo fidelizas a un cliente?","long_text"],
    ["Servicio al cliente","¿Qué significa para ti brindar un excelente servicio?","long_text"],
    ["Negociación","¿Cómo manejas las objeciones de un cliente?","long_text"],
    ["Motivación","¿Qué te motiva a trabajar en ventas?","long_text"],
    ["Organización","¿Cómo priorizas tus actividades diarias?","long_text"],
    ["Negociación","¿Qué harías si un cliente solicita un descuento que no puedes autorizar?","long_text"],
    ["Orientación a resultados","Cuéntanos cuál ha sido tu mayor logro comercial.","long_text"],
    ["Motivación","¿Por qué quieres trabajar en Momento?","long_text"],
    ["Diferenciación","¿Qué te diferencia de otros candidatos para esta posición?","long_text"]
  ]'::jsonb;
  item jsonb;
  i int;
BEGIN
  FOREACH v IN ARRAY v_ids LOOP
    i := 0;
    FOR item IN SELECT * FROM jsonb_array_elements(q_data) LOOP
      INSERT INTO public.questions (vacancy_id, category, question, answer_type, order_index)
      VALUES (v, item->>0, item->>1, (item->>2)::public.answer_type, i);
      i := i + 1;
    END LOOP;
  END LOOP;
END $$;

DO $$
DECLARE
  v uuid := '00000000-0000-4000-8000-000000000013';
  q_data jsonb := '[
    ["Liderazgo","¿Cuántos años de experiencia liderando equipos comerciales tienes?","number"],
    ["Gestión de equipos","¿Cuál ha sido el número máximo de personas que has gestionado?","number"],
    ["Liderazgo","Describe tu estilo de liderazgo.","long_text"],
    ["Coaching","¿Cómo motivas a un equipo cuando no alcanza sus objetivos?","long_text"],
    ["Resolución de conflictos","¿Cómo manejas un conflicto entre colaboradores?","long_text"],
    ["Coaching","¿Cómo das retroalimentación a un colaborador con bajo desempeño?","long_text"],
    ["Orientación a resultados","¿Qué indicadores comerciales utilizas para medir el desempeño?","long_text"],
    ["Gestión de equipos","¿Cómo realizas el seguimiento de objetivos de tu equipo?","long_text"],
    ["Liderazgo","Describe el mayor logro que has obtenido como líder.","long_text"],
    ["Desarrollo de talento","¿Cómo desarrollas el talento de tus colaboradores?","long_text"],
    ["Planeación estratégica","¿Cómo organizas el trabajo de tu equipo?","long_text"],
    ["Gestión de equipos","¿Qué harías si uno de tus mejores vendedores decide renunciar?","long_text"],
    ["Trabajo bajo presión","¿Cómo manejas la presión por resultados?","long_text"],
    ["Liderazgo","Califica tu liderazgo del 1 al 5.","scale_1_5"],
    ["Liderazgo","Califica tu capacidad para tomar decisiones del 1 al 5.","scale_1_5"],
    ["Planeación estratégica","¿Cómo estableces prioridades dentro de tu equipo?","long_text"],
    ["Liderazgo","¿Qué significa para ti ser un buen líder?","long_text"],
    ["Liderazgo","¿Cómo equilibras el cumplimiento de metas con el bienestar del equipo?","long_text"],
    ["Motivación","¿Por qué consideras que eres el candidato ideal para esta posición?","long_text"],
    ["Planeación estratégica","¿Qué esperas lograr durante tu primer año como Líder Territorial?","long_text"]
  ]'::jsonb;
  item jsonb;
  i int := 0;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(q_data) LOOP
    INSERT INTO public.questions (vacancy_id, category, question, answer_type, order_index)
    VALUES (v, item->>0, item->>1, (item->>2)::public.answer_type, i);
    i := i + 1;
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.get_evaluation_questions(uuid,integer);
CREATE FUNCTION public.get_evaluation_questions(_vacancy_id uuid, _limit integer DEFAULT 50)
RETURNS TABLE(id uuid, category text, question text, answer_type public.answer_type, order_index integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.id, q.category, q.question, q.answer_type, q.order_index
  FROM public.questions q
  WHERE q.vacancy_id = _vacancy_id
  ORDER BY q.order_index ASC
  LIMIT _limit;
$$;

DROP FUNCTION IF EXISTS public.submit_evaluation_answer(uuid,uuid,question_option,integer);
CREATE OR REPLACE FUNCTION public.submit_evaluation_answer(
  _evaluation_id uuid, _question_id uuid, _answer_text text, _time_ms integer DEFAULT 0
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _status public.evaluation_status;
BEGIN
  SELECT status INTO _status FROM public.evaluations WHERE id = _evaluation_id;
  IF _status IS NULL THEN RAISE EXCEPTION 'evaluation not found'; END IF;
  IF _status <> 'in_progress' THEN RAISE EXCEPTION 'evaluation is not in progress'; END IF;

  INSERT INTO public.evaluation_answers (evaluation_id, question_id, answer_text, selected_option, is_correct, time_ms)
  VALUES (_evaluation_id, _question_id, NULLIF(trim(_answer_text), ''), NULL, false, COALESCE(_time_ms, 0))
  ON CONFLICT (evaluation_id, question_id) DO UPDATE
    SET answer_text = EXCLUDED.answer_text, time_ms = EXCLUDED.time_ms;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.finalize_evaluation(_evaluation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _total int; _answered int; _avg int;
BEGIN
  SELECT count(*)::int INTO _total FROM public.questions q
    JOIN public.evaluations e ON e.vacancy_id = q.vacancy_id
    WHERE e.id = _evaluation_id;

  SELECT count(*) FILTER (WHERE answer_text IS NOT NULL)::int,
         COALESCE(avg(time_ms),0)::int
  INTO _answered, _avg
  FROM public.evaluation_answers WHERE evaluation_id = _evaluation_id;

  UPDATE public.evaluations SET
    status = 'completed', total_questions = _total, total_correct = _answered,
    percentage = 0, avg_time_ms = _avg, score = 0, compatibility = NULL,
    finished_at = now(), updated_at = now()
  WHERE id = _evaluation_id;

  RETURN jsonb_build_object('total', _total, 'answered', _answered);
END; $$;

GRANT EXECUTE ON FUNCTION public.get_evaluation_questions(uuid,integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_evaluation_answer(uuid,uuid,text,integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_evaluation(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_evaluation(uuid,uuid,uuid) TO anon, authenticated;
