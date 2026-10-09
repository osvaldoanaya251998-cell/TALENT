
-- ============ Evaluation platform schema ============

CREATE TYPE public.question_option AS ENUM ('A','B','C','D','E');
CREATE TYPE public.evaluation_status AS ENUM ('in_progress','completed','abandoned');

-- Vacancies
CREATE TABLE public.vacancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vacancies TO anon, authenticated;
GRANT ALL ON public.vacancies TO service_role;
ALTER TABLE public.vacancies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vacancies public read active" ON public.vacancies FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "vacancies admin all" ON public.vacancies FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER vacancies_touch BEFORE UPDATE ON public.vacancies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Questions (correct_option is protected — accessed only via SECURITY DEFINER RPCs)
CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id uuid REFERENCES public.vacancies(id) ON DELETE CASCADE,
  category text NOT NULL,
  question text NOT NULL,
  option_a text NOT NULL,
  option_b text NOT NULL,
  option_c text NOT NULL,
  option_d text NOT NULL,
  option_e text NOT NULL,
  correct_option public.question_option NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- NO anon/authenticated grants — client access only via RPCs
GRANT ALL ON public.questions TO service_role;
GRANT SELECT ON public.questions TO authenticated; -- admins read via RLS below
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions admin all" ON public.questions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Applications: link to vacancy
ALTER TABLE public.applications ADD COLUMN vacancy_id uuid REFERENCES public.vacancies(id) ON DELETE SET NULL;

-- Evaluations
CREATE TABLE public.evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  application_id uuid REFERENCES public.applications(id) ON DELETE CASCADE,
  vacancy_id uuid REFERENCES public.vacancies(id) ON DELETE SET NULL,
  status public.evaluation_status NOT NULL DEFAULT 'in_progress',
  total_questions int NOT NULL DEFAULT 0,
  total_correct int NOT NULL DEFAULT 0,
  percentage numeric(5,2) NOT NULL DEFAULT 0,
  avg_time_ms int NOT NULL DEFAULT 0,
  score int NOT NULL DEFAULT 0,
  compatibility text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.evaluations TO anon, authenticated;
GRANT ALL ON public.evaluations TO service_role;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
-- Anon can read a specific evaluation (by UUID they hold) for the results page
CREATE POLICY "evaluations public read" ON public.evaluations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "evaluations admin write" ON public.evaluations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER evaluations_touch BEFORE UPDATE ON public.evaluations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Evaluation answers
CREATE TABLE public.evaluation_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_option public.question_option,
  is_correct boolean NOT NULL DEFAULT false,
  time_ms int NOT NULL DEFAULT 15000,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evaluation_id, question_id)
);
-- No direct anon access; RPC-only for writes. Admin reads.
GRANT SELECT ON public.evaluation_answers TO authenticated;
GRANT ALL ON public.evaluation_answers TO service_role;
ALTER TABLE public.evaluation_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eval answers admin read" ON public.evaluation_answers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Evaluation results (per-category breakdown)
CREATE TABLE public.evaluation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  category text NOT NULL,
  total int NOT NULL,
  correct int NOT NULL,
  percentage numeric(5,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evaluation_id, category)
);
GRANT SELECT ON public.evaluation_results TO anon, authenticated;
GRANT ALL ON public.evaluation_results TO service_role;
ALTER TABLE public.evaluation_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eval results public read" ON public.evaluation_results FOR SELECT TO anon, authenticated USING (true);

-- ============ RPCs ============

-- Return sanitized questions (no correct_option)
CREATE OR REPLACE FUNCTION public.get_evaluation_questions(_vacancy_id uuid, _limit int DEFAULT 20)
RETURNS TABLE (
  id uuid, category text, question text,
  option_a text, option_b text, option_c text, option_d text, option_e text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.id, q.category, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e
  FROM public.questions q
  WHERE _vacancy_id IS NULL OR q.vacancy_id = _vacancy_id OR q.vacancy_id IS NULL
  ORDER BY random()
  LIMIT _limit;
$$;
GRANT EXECUTE ON FUNCTION public.get_evaluation_questions(uuid, int) TO anon, authenticated;

-- Start an evaluation
CREATE OR REPLACE FUNCTION public.start_evaluation(_candidate_id uuid, _application_id uuid, _vacancy_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF _candidate_id IS NULL THEN RAISE EXCEPTION 'candidate_id required'; END IF;
  INSERT INTO public.evaluations (candidate_id, application_id, vacancy_id)
  VALUES (_candidate_id, _application_id, _vacancy_id)
  RETURNING id INTO _id;
  RETURN _id;
END; $$;
GRANT EXECUTE ON FUNCTION public.start_evaluation(uuid, uuid, uuid) TO anon, authenticated;

-- Submit an answer (grades server-side)
CREATE OR REPLACE FUNCTION public.submit_evaluation_answer(
  _evaluation_id uuid, _question_id uuid, _selected public.question_option, _time_ms int
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _correct public.question_option; _is_correct boolean; _status public.evaluation_status;
BEGIN
  SELECT status INTO _status FROM public.evaluations WHERE id = _evaluation_id;
  IF _status IS NULL THEN RAISE EXCEPTION 'evaluation not found'; END IF;
  IF _status <> 'in_progress' THEN RAISE EXCEPTION 'evaluation is not in progress'; END IF;
  SELECT correct_option INTO _correct FROM public.questions WHERE id = _question_id;
  IF _correct IS NULL THEN RAISE EXCEPTION 'question not found'; END IF;
  _is_correct := (_selected IS NOT NULL AND _selected = _correct);
  INSERT INTO public.evaluation_answers (evaluation_id, question_id, selected_option, is_correct, time_ms)
  VALUES (_evaluation_id, _question_id, _selected, _is_correct, COALESCE(_time_ms, 15000))
  ON CONFLICT (evaluation_id, question_id) DO UPDATE
    SET selected_option = EXCLUDED.selected_option,
        is_correct = EXCLUDED.is_correct,
        time_ms = EXCLUDED.time_ms;
  RETURN _is_correct;
END; $$;
GRANT EXECUTE ON FUNCTION public.submit_evaluation_answer(uuid, uuid, public.question_option, int) TO anon, authenticated;

-- Finalize + compute breakdown
CREATE OR REPLACE FUNCTION public.finalize_evaluation(_evaluation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _total int; _correct int; _avg int; _pct numeric; _score int; _compat text; _result jsonb;
BEGIN
  SELECT count(*)::int, count(*) FILTER (WHERE is_correct)::int, COALESCE(avg(time_ms),0)::int
  INTO _total, _correct, _avg
  FROM public.evaluation_answers WHERE evaluation_id = _evaluation_id;

  _pct := CASE WHEN _total > 0 THEN round((_correct::numeric / _total) * 100, 2) ELSE 0 END;
  _score := _correct * 5;
  _compat := CASE
    WHEN _pct >= 85 THEN 'Excelente'
    WHEN _pct >= 70 THEN 'Alta'
    WHEN _pct >= 50 THEN 'Media'
    ELSE 'Baja'
  END;

  UPDATE public.evaluations SET
    status = 'completed', total_questions = _total, total_correct = _correct,
    percentage = _pct, avg_time_ms = _avg, score = _score, compatibility = _compat,
    finished_at = now(), updated_at = now()
  WHERE id = _evaluation_id;

  DELETE FROM public.evaluation_results WHERE evaluation_id = _evaluation_id;
  INSERT INTO public.evaluation_results (evaluation_id, category, total, correct, percentage)
  SELECT _evaluation_id, q.category, count(*)::int, count(*) FILTER (WHERE ea.is_correct)::int,
    round((count(*) FILTER (WHERE ea.is_correct)::numeric / NULLIF(count(*),0)) * 100, 2)
  FROM public.evaluation_answers ea
  JOIN public.questions q ON q.id = ea.question_id
  WHERE ea.evaluation_id = _evaluation_id
  GROUP BY q.category;

  SELECT jsonb_build_object(
    'total', _total, 'correct', _correct, 'percentage', _pct, 'avg_time_ms', _avg,
    'score', _score, 'compatibility', _compat,
    'categories', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'category', category, 'total', total, 'correct', correct, 'percentage', percentage
      ) ORDER BY percentage DESC) FROM public.evaluation_results WHERE evaluation_id = _evaluation_id), '[]'::jsonb)
  ) INTO _result;
  RETURN _result;
END; $$;
GRANT EXECUTE ON FUNCTION public.finalize_evaluation(uuid) TO anon, authenticated;

-- ============ Seed: default vacancy + 20 questions ============
INSERT INTO public.vacancies (id, title, slug, description)
VALUES ('00000000-0000-4000-8000-000000000001', 'Ejecutivo Comercial Momento', 'ejecutivo-comercial', 'Rol comercial de alto impacto en Momento.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.questions (vacancy_id, category, question, option_a, option_b, option_c, option_d, option_e, correct_option, order_index) VALUES
-- Ventas (5)
('00000000-0000-4000-8000-000000000001','Ventas','¿Qué es el ciclo de ventas?','El tiempo desde prospección hasta cierre','El horario del vendedor','El calendario fiscal','Un ciclo económico','El tiempo de entrega','A',1),
('00000000-0000-4000-8000-000000000001','Ventas','¿Qué significa SPIN Selling?','Situación, Problema, Implicación, Necesidad','Sales, Product, Info, Net','Simple, Positive, Instant, New','Solo Preguntas Interesantes','Ninguna','A',2),
('00000000-0000-4000-8000-000000000001','Ventas','El upselling consiste en:','Vender un producto de mayor valor al mismo cliente','Vender más barato','Regalar productos','Cambiar de cliente','Bajar precios','A',3),
('00000000-0000-4000-8000-000000000001','Ventas','Un lead calificado es:','Un prospecto con intención y capacidad de compra','Cualquier persona','Un cliente antiguo','Un empleado','Un proveedor','A',4),
('00000000-0000-4000-8000-000000000001','Ventas','¿Qué es una objeción en ventas?','Una razón que frena la compra','Un descuento','Un contrato','Una queja de RH','Una comisión','A',5),
-- Comunicación (4)
('00000000-0000-4000-8000-000000000001','Comunicación','La escucha activa implica:','Prestar atención plena y confirmar comprensión','Interrumpir para acelerar','Solo tomar notas','Repetir palabra por palabra','Ignorar tono','A',6),
('00000000-0000-4000-8000-000000000001','Comunicación','Ante un cliente enojado, lo primero es:','Empatizar y escuchar','Defenderse','Colgar','Ofrecer descuento','Escalar al jefe','A',7),
('00000000-0000-4000-8000-000000000001','Comunicación','Comunicación asertiva es:','Expresar ideas con claridad y respeto','Ser agresivo','Ser pasivo','Evadir el tema','Solo escuchar','A',8),
('00000000-0000-4000-8000-000000000001','Comunicación','Una pregunta abierta:','Invita a desarrollar la respuesta','Se responde con sí/no','Es cerrada','No aplica en ventas','Confunde al cliente','A',9),
-- Producto / Fintech (4)
('00000000-0000-4000-8000-000000000001','Producto','CAT en un crédito significa:','Costo Anual Total','Cliente Anual Tarifa','Cuenta Anual Transferida','Cobro Automático Total','Crédito Autorizado Temporal','A',10),
('00000000-0000-4000-8000-000000000001','Producto','El buró de crédito registra:','Historial crediticio de personas','Antecedentes penales','Datos fiscales del SAT','Cuentas bancarias','Empleos previos','A',11),
('00000000-0000-4000-8000-000000000001','Producto','Una tasa fija implica:','Que no cambia durante el plazo','Que sube cada mes','Que baja con el tiempo','Que depende de la bolsa','Ninguna','A',12),
('00000000-0000-4000-8000-000000000001','Producto','KYC en fintech significa:','Know Your Customer','Keep Your Cash','Key Yield Contract','Know Your Contract','Kind Your Client','A',13),
-- Actitud (4)
('00000000-0000-4000-8000-000000000001','Actitud','Ante una meta ambiciosa reaccionas:','La divido en pasos y la ejecuto','La rechazo','Espero indicaciones','Me estreso y pauso','La ignoro','A',14),
('00000000-0000-4000-8000-000000000001','Actitud','Si un cliente te dice "no", tú:','Aprendo y sigo prospectando','Me desanimo','Insisto agresivamente','Miento','Cierro el día','A',15),
('00000000-0000-4000-8000-000000000001','Actitud','La mejor forma de mejorar es:','Feedback + práctica constante','Solo experiencia','Solo estudio','No mejorar','Cambiar de área','A',16),
('00000000-0000-4000-8000-000000000001','Actitud','El trabajo en equipo requiere:','Comunicación y responsabilidad compartida','Solo un líder','Silencio','Competencia interna','Individualismo','A',17),
-- Lógica / Números (3)
('00000000-0000-4000-8000-000000000001','Lógica','Si vendes 20 unidades a $500 c/u, tu ingreso es:','$10,000','$1,000','$5,000','$20,000','$2,500','A',18),
('00000000-0000-4000-8000-000000000001','Lógica','15% de $8,000 =','$1,200','$800','$1,500','$120','$2,000','A',19),
('00000000-0000-4000-8000-000000000001','Lógica','Si tu meta es 40 ventas al mes y llevas 10 en la semana 2, ¿vas al ritmo?','Vas por debajo del ritmo','Vas adelantado','Vas exacto','Ya cumpliste','No se puede saber','A',20);
