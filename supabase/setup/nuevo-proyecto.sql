-- TALENT: ejecutar SOLO en un proyecto Supabase nuevo.
BEGIN;

-- 20260702183012_5b76ae02-41c3-415f-9c20-35b6d124927a.sql

-- Roles
CREATE TYPE public.app_role AS ENUM ('admin','recruiter');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Application status enum
CREATE TYPE public.application_status AS ENUM ('nuevo','revisando','entrevista','aprobado','rechazado','contratado');

-- Candidates
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT NOT NULL,
  ciudad TEXT NOT NULL,
  linkedin TEXT,
  experiencia INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX candidates_email_idx ON public.candidates(email);
CREATE INDEX candidates_created_idx ON public.candidates(created_at DESC);

GRANT INSERT ON public.candidates TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can apply" ON public.candidates FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admins read candidates" ON public.candidates FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update candidates" ON public.candidates FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins delete candidates" ON public.candidates FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Applications
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  respuestas JSONB NOT NULL DEFAULT '{}'::jsonb,
  status application_status NOT NULL DEFAULT 'nuevo',
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX applications_candidate_idx ON public.applications(candidate_id);
CREATE INDEX applications_status_idx ON public.applications(status);

GRANT INSERT ON public.applications TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can create application" ON public.applications FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admins read applications" ON public.applications FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update applications" ON public.applications FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins delete applications" ON public.applications FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Uploads
CREATE TABLE public.uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  cv_url TEXT,
  video_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX uploads_candidate_idx ON public.uploads(candidate_id);

GRANT INSERT ON public.uploads TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.uploads TO authenticated;
GRANT ALL ON public.uploads TO service_role;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can insert uploads" ON public.uploads FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admins read uploads" ON public.uploads FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER applications_updated BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 20260702183034_36d62609-16b2-40b2-bb66-df8ddbc56526.sql

-- Fix search_path on trigger fn
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Storage policies for 'applications' bucket
CREATE POLICY "anyone can upload applications" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'applications');

CREATE POLICY "admins can read applications files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'applications' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "admins can delete applications files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'applications' AND public.has_role(auth.uid(),'admin'));

-- 20260702191355_e8294149-a606-4eba-a33c-7c64ef150989.sql

-- Ensure RLS is on
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

-- Ensure Data API grants (public application flow needs anon INSERT)
GRANT INSERT ON public.candidates TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;

GRANT INSERT ON public.applications TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;

GRANT INSERT ON public.uploads TO anon, authenticated;
GRANT SELECT ON public.uploads TO authenticated;
GRANT ALL ON public.uploads TO service_role;

-- Recreate INSERT policies cleanly with explicit WITH CHECK + TO roles
DROP POLICY IF EXISTS "anyone can apply" ON public.candidates;
CREATE POLICY "Public can submit candidate applications"
  ON public.candidates
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "anyone can create application" ON public.applications;
CREATE POLICY "Public can submit applications"
  ON public.applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "anyone can insert uploads" ON public.uploads;
CREATE POLICY "Public can submit uploads"
  ON public.uploads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 20260702192929_567f1d06-3aa4-42d6-9768-0df57ca21c94.sql
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.candidates TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;

GRANT INSERT ON public.applications TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;

GRANT INSERT ON public.uploads TO anon, authenticated;
GRANT SELECT ON public.uploads TO authenticated;
GRANT ALL ON public.uploads TO service_role;

DROP POLICY IF EXISTS "Public can submit candidate applications" ON public.candidates;
CREATE POLICY "Public can submit candidate applications"
ON public.candidates
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "admins read candidates" ON public.candidates;
CREATE POLICY "admins read candidates"
ON public.candidates
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admins update candidates" ON public.candidates;
CREATE POLICY "admins update candidates"
ON public.candidates
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admins delete candidates" ON public.candidates;
CREATE POLICY "admins delete candidates"
ON public.candidates
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Public can submit applications" ON public.applications;
CREATE POLICY "Public can submit applications"
ON public.applications
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can submit uploads" ON public.uploads;
CREATE POLICY "Public can submit uploads"
ON public.uploads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 20260702192956_57bf687a-51cb-4d41-a902-b86db4406f77.sql
DROP POLICY IF EXISTS "Public can submit candidate applications" ON public.candidates;
CREATE POLICY "Public can submit candidate applications"
ON public.candidates
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(nombre)) >= 2
  AND length(trim(email)) >= 5
  AND email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  AND length(trim(telefono)) >= 7
  AND length(trim(ciudad)) >= 2
  AND experiencia >= 0
  AND experiencia <= 60
);

DROP POLICY IF EXISTS "Public can submit applications" ON public.applications;
CREATE POLICY "Public can submit applications"
ON public.applications
FOR INSERT
TO anon, authenticated
WITH CHECK (
  candidate_id IS NOT NULL
  AND jsonb_typeof(respuestas) = 'object'
  AND status = 'nuevo'::application_status
);

DROP POLICY IF EXISTS "Public can submit uploads" ON public.uploads;
CREATE POLICY "Public can submit uploads"
ON public.uploads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  candidate_id IS NOT NULL
  AND cv_url IS NOT NULL
  AND length(trim(cv_url)) > 0
  AND (video_url IS NULL OR length(trim(video_url)) > 0)
);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;


-- 20260702193809_e266e6c5-5b38-49b3-86fa-c0a4d62f6043.sql

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

-- 20260702215516_c5817aa7-cbd4-4c71-afe9-a1212449702a.sql
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;

-- 20260702222151_af86c476-8ee5-4f7a-b25d-79d90ecb683e.sql

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

-- 20260702230452_dc9cf02a-e19a-411a-852c-f1459c5acb90.sql

-- 1. Add tab_switches column to evaluations
ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS tab_switches integer NOT NULL DEFAULT 0;

-- 2. Drop and recreate RPCs with new signatures
DROP FUNCTION IF EXISTS public.get_evaluation_questions(uuid, integer);
DROP FUNCTION IF EXISTS public.submit_evaluation_answer(uuid, uuid, text, integer);
DROP FUNCTION IF EXISTS public.finalize_evaluation(uuid);

CREATE OR REPLACE FUNCTION public.get_evaluation_questions(_vacancy_id uuid, _limit integer DEFAULT 20)
RETURNS TABLE(id uuid, category text, question text, option_a text, option_b text, option_c text, option_d text, order_index integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.id, q.category, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.order_index
  FROM public.questions q
  WHERE q.vacancy_id = _vacancy_id
  ORDER BY q.order_index ASC
  LIMIT _limit;
$$;

CREATE OR REPLACE FUNCTION public.submit_evaluation_answer(_evaluation_id uuid, _question_id uuid, _selected_option text, _time_ms integer DEFAULT 0)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _status public.evaluation_status; _correct public.question_option; _sel public.question_option; _is_correct boolean;
BEGIN
  SELECT status INTO _status FROM public.evaluations WHERE id = _evaluation_id;
  IF _status IS NULL THEN RAISE EXCEPTION 'evaluation not found'; END IF;
  IF _status <> 'in_progress' THEN RAISE EXCEPTION 'evaluation is not in progress'; END IF;

  SELECT correct_option INTO _correct FROM public.questions WHERE id = _question_id;

  BEGIN
    _sel := NULLIF(upper(_selected_option), '')::public.question_option;
  EXCEPTION WHEN others THEN _sel := NULL;
  END;

  _is_correct := (_sel IS NOT NULL AND _sel = _correct);

  INSERT INTO public.evaluation_answers (evaluation_id, question_id, selected_option, answer_text, is_correct, time_ms)
  VALUES (_evaluation_id, _question_id, _sel, upper(NULLIF(_selected_option, '')), _is_correct, COALESCE(_time_ms, 0))
  ON CONFLICT (evaluation_id, question_id) DO UPDATE
    SET selected_option = EXCLUDED.selected_option,
        answer_text = EXCLUDED.answer_text,
        is_correct = EXCLUDED.is_correct,
        time_ms = EXCLUDED.time_ms;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.finalize_evaluation(_evaluation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _total int; _correct int; _avg int; _pct numeric; _score int; _comp text;
BEGIN
  SELECT count(*)::int INTO _total FROM public.questions q
    JOIN public.evaluations e ON e.vacancy_id = q.vacancy_id
    WHERE e.id = _evaluation_id;

  SELECT count(*) FILTER (WHERE is_correct)::int,
         COALESCE(avg(time_ms), 0)::int
  INTO _correct, _avg
  FROM public.evaluation_answers WHERE evaluation_id = _evaluation_id;

  _pct := CASE WHEN _total > 0 THEN round((_correct::numeric / _total) * 100, 2) ELSE 0 END;
  _score := _correct * 5;
  _comp := CASE
    WHEN _pct >= 85 THEN 'alta'
    WHEN _pct >= 65 THEN 'media'
    ELSE 'baja'
  END;

  UPDATE public.evaluations SET
    status = 'completed', total_questions = _total, total_correct = _correct,
    percentage = _pct, avg_time_ms = _avg, score = _score, compatibility = _comp,
    finished_at = now(), updated_at = now()
  WHERE id = _evaluation_id;

  RETURN jsonb_build_object('total', _total, 'correct', _correct, 'percentage', _pct, 'score', _score);
END; $$;

CREATE OR REPLACE FUNCTION public.increment_tab_switch(_evaluation_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  UPDATE public.evaluations SET tab_switches = tab_switches + 1, updated_at = now()
  WHERE id = _evaluation_id AND status = 'in_progress'
  RETURNING tab_switches INTO _n;
  RETURN COALESCE(_n, 0);
END; $$;

CREATE OR REPLACE FUNCTION public.get_evaluation_progress(_evaluation_id uuid)
RETURNS TABLE(answered_ids uuid[], status public.evaluation_status)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(ea.question_id), ARRAY[]::uuid[]),
         (SELECT status FROM public.evaluations WHERE id = _evaluation_id)
  FROM public.evaluation_answers ea WHERE ea.evaluation_id = _evaluation_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_evaluation_questions(uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_evaluation_answer(uuid, uuid, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_evaluation(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_tab_switch(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_evaluation_progress(uuid) TO anon, authenticated;

-- 3. Reseed questions for the 4 target vacancies
DELETE FROM public.questions WHERE vacancy_id IN (
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000000012',
  '00000000-0000-4000-8000-000000000013'
);

INSERT INTO public.questions (vacancy_id, category, question, answer_type, option_a, option_b, option_c, option_d, correct_option, order_index) VALUES
-- Desarrollo Comercial CDMX
('00000000-0000-4000-8000-000000000010','Prospección','¿Cuál es el principal objetivo de una prospección comercial efectiva?','single_choice','Esperar a que el cliente solicite información.','Generar oportunidades calificadas de venta.','Reducir el número de cotizaciones.','Aumentar únicamente las llamadas telefónicas.','B',1),
('00000000-0000-4000-8000-000000000010','Embudo','¿Qué representa la etapa media del embudo comercial (MOFU)?','single_choice','Prospectos completamente fríos.','Leads calificados en evaluación de la solución.','Clientes ya cerrados.','Clientes recurrentes.','B',2),
('00000000-0000-4000-8000-000000000010','Objeciones','Cuando el cliente dice "está muy caro", la respuesta consultiva correcta es:','single_choice','Ofrecer descuento inmediato.','Cambiar de tema.','Indagar el criterio de valor y comparar coberturas.','Terminar la llamada.','C',3),
('00000000-0000-4000-8000-000000000010','Cierre','¿Qué técnica de cierre presenta al cliente dos opciones válidas para tomar acción?','single_choice','Cierre por urgencia.','Cierre por alternativa.','Cierre por resumen.','Cierre asumido.','B',4),
('00000000-0000-4000-8000-000000000010','Seguimiento','Buena práctica de seguimiento post-cotización:','single_choice','Llamar tres veces al día.','Enviar recordatorio con valor agregado dentro de 24-48h.','Esperar a que el cliente llame.','Enviar cotizaciones nuevas sin motivo.','B',5),
('00000000-0000-4000-8000-000000000010','CRM','Función principal de un CRM en ventas:','single_choice','Facturar.','Centralizar interacciones y etapa de cada prospecto.','Enviar campañas masivas.','Emitir pólizas.','B',6),
('00000000-0000-4000-8000-000000000010','KPI','KPI que mide la eficiencia del embudo comercial:','single_choice','NPS.','Tasa de conversión.','Costo por click.','Tiempo de emisión.','B',7),
('00000000-0000-4000-8000-000000000010','Cross Selling','Cross-selling en seguros consiste en:','single_choice','Vender la misma póliza a otro cliente.','Ofrecer productos complementarios al cliente actual.','Cancelar y reemitir.','Otorgar descuento por lealtad.','B',8),
('00000000-0000-4000-8000-000000000010','Up Selling','Ejemplo de up-selling en autos:','single_choice','Vender un seguro de vida.','Subir de cobertura limitada a amplia.','Cambiar de aseguradora.','Vender la póliza a un tercero.','B',9),
('00000000-0000-4000-8000-000000000010','Coberturas','Cobertura que ampara daños a terceros:','single_choice','Daños materiales.','Robo total.','Responsabilidad Civil.','Gastos médicos ocupantes.','C',10),
('00000000-0000-4000-8000-000000000010','Deducible','El deducible representa:','single_choice','La prima anual.','El monto que asume el asegurado antes de la aseguradora.','La comisión del agente.','El precio del vehículo.','B',11),
('00000000-0000-4000-8000-000000000010','Suma asegurada','La suma asegurada es:','single_choice','El deducible.','La prima anual.','El monto máximo que paga la aseguradora ante un siniestro.','El descuento aplicable.','C',12),
('00000000-0000-4000-8000-000000000010','Valor comercial','Diferencia entre valor comercial y valor factura:','single_choice','Comercial es el precio de mercado; factura es el precio original de compra.','Son iguales.','Comercial siempre es más caro.','Factura solo aplica a autos usados.','A',13),
('00000000-0000-4000-8000-000000000010','Valor convenido','El valor convenido en un seguro de auto es:','single_choice','El promedio del mercado.','Un monto pactado entre asegurado y aseguradora que se paga íntegro en pérdida total.','Igual al deducible.','El valor de reventa.','B',14),
('00000000-0000-4000-8000-000000000010','Endosos','Un endoso es:','single_choice','Un descuento.','Una modificación oficial a la póliza vigente.','La renovación anual.','Un pago diferido.','B',15),
('00000000-0000-4000-8000-000000000010','Emisión','Al emitir una póliza se genera:','single_choice','Una cotización.','La carátula/póliza oficial.','Un endoso.','Un recibo de siniestro.','B',16),
('00000000-0000-4000-8000-000000000010','Renovaciones','Buena práctica en renovaciones:','single_choice','Contactar al cliente 30-45 días antes del vencimiento.','Emitir sin avisar.','Cancelar si no responde.','Cambiar aseguradora sin autorización.','A',17),
('00000000-0000-4000-8000-000000000010','Siniestros','Ante un reporte de siniestro, el ejecutivo debe:','single_choice','Ignorarlo hasta el día siguiente.','Guiar el reporte y dar acompañamiento hasta el ajuste.','Cerrar la póliza.','Ofrecer descuento.','B',18),
('00000000-0000-4000-8000-000000000010','Servicio','Lo que genera lealtad en el cliente asegurado es:','single_choice','Sólo precio bajo.','Acompañamiento y servicio post-venta consistente.','Contactarlo únicamente en la renovación.','Descuentos aleatorios.','B',19),
('00000000-0000-4000-8000-000000000010','Regulatorio','En México, la CNSF es:','single_choice','Autoridad reguladora del sector asegurador.','Una aseguradora privada.','Un corredor de seguros.','Una compañía reaseguradora.','A',20),

-- Desarrollo Comercial Querétaro
('00000000-0000-4000-8000-000000000011','Prospección','Un prospecto calificado (SQL) es aquel que:','single_choice','Sólo dio su email.','Tiene necesidad, presupuesto, autoridad y tiempo (BANT).','Es familiar del ejecutivo.','Aún no responde.','B',1),
('00000000-0000-4000-8000-000000000011','Embudo','En TOFU/MOFU/BOFU, BOFU significa:','single_choice','Top of funnel (descubrimiento).','Middle of funnel.','Bottom of funnel (decisión de compra).','Marketing genérico.','C',2),
('00000000-0000-4000-8000-000000000011','Objeciones','Ante "lo voy a pensar", la mejor acción es:','single_choice','Cerrar la llamada.','Indagar qué información falta para decidir.','Bajar el precio de inmediato.','Enviar más info sin preguntar.','B',3),
('00000000-0000-4000-8000-000000000011','Cierre','El cierre por resumen consiste en:','single_choice','Recapitular beneficios acordados y pedir la decisión.','Ofrecer un regalo.','Insistir cinco veces.','Enviar cotización sin cita.','A',4),
('00000000-0000-4000-8000-000000000011','Seguimiento','Cadencia recomendada para un lead caliente:','single_choice','Cada 15 días.','Contacto dentro de las primeras 24 horas.','Sólo al mes.','Nunca.','B',5),
('00000000-0000-4000-8000-000000000011','CRM','El estatus "perdido" en el CRM debe:','single_choice','Borrarse.','Registrarse con motivo de pérdida para análisis.','Ignorarse.','Reasignarse automáticamente.','B',6),
('00000000-0000-4000-8000-000000000011','KPI','El ticket promedio mide:','single_choice','Prima promedio por póliza vendida.','Número de citas.','Duración de llamadas.','Tasa de retención.','A',7),
('00000000-0000-4000-8000-000000000011','Cross Selling','El cross-selling ideal parte de:','single_choice','Ofrecer cualquier producto.','Analizar necesidades no cubiertas del cliente actual.','Enviar catálogo masivo.','Ofrecer descuento.','B',8),
('00000000-0000-4000-8000-000000000011','Up Selling','Up-selling en gastos médicos, ejemplo:','single_choice','Vender póliza de auto.','Subir de suma asegurada básica a plan platino.','Cambiar beneficiario.','Reducir deducible.','B',9),
('00000000-0000-4000-8000-000000000011','Coberturas','La cobertura de daños materiales protege contra:','single_choice','Robo del vehículo.','Daños al propio vehículo por colisión o volcadura.','Responsabilidad a terceros.','Gastos médicos ocupantes.','B',10),
('00000000-0000-4000-8000-000000000011','Deducible','Un deducible del 5% sobre suma asegurada de $200,000 equivale a:','single_choice','$2,000.','$5,000.','$10,000.','$20,000.','C',11),
('00000000-0000-4000-8000-000000000011','Suma asegurada','Una suma asegurada insuficiente puede derivar en:','single_choice','Bonificación al asegurado.','Aplicación de infraseguro y pago proporcional del siniestro.','Cobertura total sin descuento.','Ningún efecto.','B',12),
('00000000-0000-4000-8000-000000000011','Valor factura','El valor factura conviene principalmente en autos:','single_choice','Con más de 5 años.','Nuevos, generalmente del año en curso.','Únicamente usados.','Blindados.','B',13),
('00000000-0000-4000-8000-000000000011','Valor convenido','¿Cuándo aplica el valor convenido?','single_choice','Autos clásicos o de alto valor con avalúo.','Autos nuevos genéricos.','Sólo motocicletas.','Nunca.','A',14),
('00000000-0000-4000-8000-000000000011','Endosos','Un endoso tipo B típicamente modifica:','single_choice','Nada, es informativo.','Datos del asegurado o del riesgo (sin prima).','Solo la prima.','El emisor de la póliza.','B',15),
('00000000-0000-4000-8000-000000000011','Emisión','La emisión electrónica requiere:','single_choice','Firma autógrafa exclusivamente.','Datos completos del contratante y validación del riesgo.','Ningún dato.','Solo el pago.','B',16),
('00000000-0000-4000-8000-000000000011','Renovaciones','La persistencia en renovaciones se define como:','single_choice','Número de siniestros.','Porcentaje de pólizas que se renuevan sobre las vencidas.','Comisión del agente.','Prima total.','B',17),
('00000000-0000-4000-8000-000000000011','Siniestros','El ajustador de la aseguradora tiene la función de:','single_choice','Cobrar la prima.','Valuar el daño y determinar la procedencia del siniestro.','Vender coberturas adicionales.','Emitir la póliza.','B',18),
('00000000-0000-4000-8000-000000000011','Servicio','El NPS en servicio al cliente mide:','single_choice','Ventas totales.','Probabilidad de recomendación del cliente.','Reclamos abiertos.','Renovaciones anuales.','B',19),
('00000000-0000-4000-8000-000000000011','Regulatorio','La CONDUSEF tiene como función:','single_choice','Regular aseguradoras.','Proteger y defender al usuario de servicios financieros.','Vender seguros.','Reasegurar riesgos.','B',20),

-- Desarrollo Comercial Guadalajara
('00000000-0000-4000-8000-000000000012','Prospección','El cold calling es más efectivo cuando:','single_choice','Se llama sin guion.','Se investiga previamente al prospecto y se aporta valor.','Se llama masivamente sin filtro.','Se lee un guion sin adaptarlo.','B',1),
('00000000-0000-4000-8000-000000000012','Embudo','La conversión de MQL a SQL mide:','single_choice','Alcance del marketing masivo.','Calidad en la calificación del lead por ventas.','Tasa de cierre final.','Cobranza.','B',2),
('00000000-0000-4000-8000-000000000012','Objeciones','Ante "ya tengo seguro con otro", la mejor acción es:','single_choice','Insistir en cancelar de inmediato.','Solicitar la carátula para comparar coberturas y valor.','Bajar el precio sin analizar.','Colgar.','B',3),
('00000000-0000-4000-8000-000000000012','Cierre','El cierre asumido consiste en:','single_choice','Suponer que el cliente no comprará.','Avanzar como si la decisión ya estuviera tomada.','Presionar con descuentos.','Cancelar la cita.','B',4),
('00000000-0000-4000-8000-000000000012','Seguimiento','El principal indicador de un buen seguimiento es:','single_choice','Cantidad de llamadas realizadas.','Avance del prospecto en las etapas del embudo.','Correos enviados.','Tiempo total hablado.','B',5),
('00000000-0000-4000-8000-000000000012','Pipeline','Un pipeline saludable requiere:','single_choice','Sólo leads viejos.','Volumen suficiente y proporción por etapa (aprox 3x la cuota).','Un solo cliente grande.','No dar seguimiento.','B',6),
('00000000-0000-4000-8000-000000000012','KPI','La tasa de cierre se calcula como:','single_choice','Cotizaciones enviadas / ventas.','Pólizas emitidas / oportunidades trabajadas.','Llamadas / citas.','Ingresos / gastos.','B',7),
('00000000-0000-4000-8000-000000000012','Cross Selling','Un cliente con seguro de auto es candidato natural para:','single_choice','Reaseguro.','Hogar, vida o gastos médicos.','Fianza judicial.','Reaseguro facultativo.','B',8),
('00000000-0000-4000-8000-000000000012','Up Selling','Up-selling en autos implica:','single_choice','Vender un segundo auto.','Ofrecer coberturas adicionales (auto sustituto, cero deducible, asistencia premium).','Reducir la prima.','Cambiar de aseguradora.','B',9),
('00000000-0000-4000-8000-000000000012','Coberturas','La cobertura de robo total ampara:','single_choice','Robo parcial de autopartes.','Pérdida por robo del vehículo completo con reporte al MP y NIV.','Vidrios rotos.','Responsabilidad Civil.','B',10),
('00000000-0000-4000-8000-000000000012','Deducible','El deducible se aplica principalmente en:','single_choice','RC a terceros.','Daños materiales y robo total.','Gastos médicos por ley.','Ninguna cobertura.','B',11),
('00000000-0000-4000-8000-000000000012','Suma asegurada','La suma asegurada debe actualizarse:','single_choice','Cada 5 años.','En cada renovación conforme al valor del bien.','Nunca.','Sólo al ocurrir un siniestro.','B',12),
('00000000-0000-4000-8000-000000000012','Valor comercial','El valor comercial se determina con:','single_choice','El precio de venta original.','Guías de mercado (EBC/Libro Azul) u otros referentes.','El costo de reparación.','El avalúo del taller.','B',13),
('00000000-0000-4000-8000-000000000012','Valor convenido','Comparado con valor factura, el valor convenido:','single_choice','Es menor en todos los casos.','Se pacta y suele usarse en autos especializados o clásicos.','Es idéntico al valor factura.','No existe en México.','B',14),
('00000000-0000-4000-8000-000000000012','Endosos','Un endoso tipo A típicamente:','single_choice','Es sólo administrativo, sin efecto en prima.','Modifica prima o coberturas.','Cancela la póliza.','Renueva la póliza.','A',15),
('00000000-0000-4000-8000-000000000012','Emisión','Antes de emitir, el suscriptor evalúa:','single_choice','Marketing del producto.','Riesgo, siniestralidad e información del solicitante.','Diseño gráfico.','Comisión del agente.','B',16),
('00000000-0000-4000-8000-000000000012','Renovaciones','Una póliza no renovada fuera del periodo de gracia:','single_choice','Sigue vigente sin cambios.','Pierde continuidad y beneficios acumulados.','Se duplica automáticamente.','No tiene efecto alguno.','B',17),
('00000000-0000-4000-8000-000000000012','Siniestros','La carpeta de investigación aplica cuando:','single_choice','Es un raspón menor.','Hay hechos con posible responsabilidad penal (choque con lesionados, robo).','Nunca es necesaria.','En todos los siniestros.','B',18),
('00000000-0000-4000-8000-000000000012','Servicio','La primera impresión en servicio al cliente se genera en:','single_choice','La renovación anual.','Primer contacto y proceso de cotización/emisión.','Al reportar un siniestro.','En la cobranza.','B',19),
('00000000-0000-4000-8000-000000000012','Regulatorio','El PLD (Prevención de Lavado de Dinero) en seguros obliga a:','single_choice','No hacer nada especial.','Identificar al cliente y reportar operaciones inusuales.','Sólo aplica a bancos.','Sólo aplica a directivos.','B',20),

-- Líder Territorial Guadalajara
('00000000-0000-4000-8000-000000000013','Liderazgo','Un líder comercial efectivo prioriza:','single_choice','Cerrar personalmente todas las ventas.','Desarrollar al equipo para que produzca de forma sostenida.','Trabajar en solitario.','Sólo enviar reportes.','B',1),
('00000000-0000-4000-8000-000000000013','Administración','La reunión 1:1 semanal sirve para:','single_choice','Regañar al colaborador.','Coachear, revisar pipeline y remover bloqueos.','Anunciar despidos.','Rellenar la agenda.','B',2),
('00000000-0000-4000-8000-000000000013','KPI','KPI que mide la productividad individual del asesor:','single_choice','NPS.','Pólizas emitidas y prima colocada por asesor.','Rotación general del equipo.','Bonos entregados.','B',3),
('00000000-0000-4000-8000-000000000013','Coaching','El modelo GROW se enfoca en:','single_choice','Ganancia neta.','Meta, Realidad, Opciones y Voluntad.','Reglas y sanciones.','Reprimenda y control.','B',4),
('00000000-0000-4000-8000-000000000013','Desarrollo','Un plan de carrera para asesores debe:','single_choice','Ser genérico y verbal.','Definir niveles, competencias y compensación creciente.','No existir para no comprometer.','Aplicarse solo a directivos.','B',5),
('00000000-0000-4000-8000-000000000013','Estrategia','Un análisis FODA en la plaza sirve para:','single_choice','Definir diseño publicitario.','Identificar fortalezas y oportunidades para el plan comercial.','Calcular nómina.','Definir marketing global.','B',6),
('00000000-0000-4000-8000-000000000013','Planeación','La cuota anual debe desglosarse en:','single_choice','Sólo cuota trimestral.','Meta mensual/semanal con actividades requeridas.','Sólo total anual sin plan.','Meta diaria sin planeación.','B',7),
('00000000-0000-4000-8000-000000000013','Cumplimiento','Cuando el equipo va por debajo de meta, el líder debe:','single_choice','Culpar públicamente.','Diagnosticar causas y ajustar el plan de acción.','Reducir la meta.','Ignorar el desvío.','B',8),
('00000000-0000-4000-8000-000000000013','Cartera','La persistencia mensual mide:','single_choice','Nuevas ventas.','Pólizas que permanecen vigentes vs. las canceladas o no renovadas.','Prospectos generados.','Comisiones pagadas.','B',9),
('00000000-0000-4000-8000-000000000013','Indicadores','El costo de adquisición de cliente (CAC) es útil para:','single_choice','Diseñar publicidad.','Medir la eficiencia de la inversión en captación.','Contabilidad fiscal.','Calcular renovaciones.','B',10),
('00000000-0000-4000-8000-000000000013','Productividad','La ratio actividad/resultado ayuda a:','single_choice','Renovar pólizas.','Identificar cuántas actividades genera una venta y ajustar el proceso.','Contratar personal.','Diseñar publicidad.','B',11),
('00000000-0000-4000-8000-000000000013','Reclutamiento','Un perfil comercial exitoso combina:','single_choice','Sólo estudios formales.','Habilidades blandas, orientación a resultados y capacidad de aprendizaje.','La edad del candidato.','La apariencia física.','B',12),
('00000000-0000-4000-8000-000000000013','Capacitación','El onboarding de un nuevo asesor debe incluir:','single_choice','Sólo información de producto.','Producto, procesos, sistemas, script y acompañamiento en campo.','Únicamente teoría.','Sólo temas de compliance.','B',13),
('00000000-0000-4000-8000-000000000013','Seguimiento','El forecast semanal del líder debe basarse en:','single_choice','La intuición del líder.','Datos del CRM y probabilidad de cierre por etapa.','Rumor del equipo.','Correos sueltos.','B',14),
('00000000-0000-4000-8000-000000000013','Rentabilidad','El margen de contribución por asesor considera:','single_choice','Sólo la prima colocada.','Prima menos costos directos asociados a la venta.','Únicamente la comisión.','Sólo los bonos.','B',15),
('00000000-0000-4000-8000-000000000013','Liderazgo','El liderazgo situacional plantea que:','single_choice','Se dirige igual a todos los colaboradores.','El estilo se adapta al nivel de madurez del colaborador.','Sólo aplica a nuevos jefes.','No aplica en ventas.','B',16),
('00000000-0000-4000-8000-000000000013','Estrategia','Un plan de plaza efectivo prioriza:','single_choice','Publicidad masiva sin segmentar.','Segmentos con mayor potencial y penetración por asesor.','Reducir el equipo comercial.','Sólo canal digital.','B',17),
('00000000-0000-4000-8000-000000000013','Gestión','Ante un conflicto en el equipo, el líder debe:','single_choice','Ignorarlo hasta que se resuelva solo.','Escuchar a las partes y resolver con datos y responsabilidades claras.','Despedir al involucrado.','Reasignar sin dialogar.','B',18),
('00000000-0000-4000-8000-000000000013','Cumplimiento','El líder es responsable de:','single_choice','Sólo generar ventas.','Que su equipo cumpla PLD, ética y normativa CNSF/CONDUSEF.','Sólo comisiones.','Sólo dar capacitaciones.','B',19),
('00000000-0000-4000-8000-000000000013','Talento','La alta rotación en un equipo comercial suele deberse a:','single_choice','Buen liderazgo.','Falta de coaching, expectativas mal definidas o compensación no competitiva.','Muchos clientes.','Días de vacaciones.','B',20);

-- 20260702232222_600fd4b4-ef92-4eac-ba41-2fc31f0bc486.sql

DO $$
DECLARE
  q RECORD;
  new_pos public.question_option;
  opts text[];
  correct_text text;
  target_text text;
  idx_correct int;
  idx_new int;
BEGIN
  FOR q IN SELECT id, correct_option, option_a, option_b, option_c, option_d FROM public.questions LOOP
    new_pos := (ARRAY['A','B','C','D']::public.question_option[])[1 + floor(random()*4)::int];
    IF new_pos = q.correct_option THEN
      CONTINUE;
    END IF;
    opts := ARRAY[q.option_a, q.option_b, q.option_c, q.option_d];
    idx_correct := CASE q.correct_option WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 WHEN 'D' THEN 4 END;
    idx_new := CASE new_pos WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 WHEN 'D' THEN 4 END;
    correct_text := opts[idx_correct];
    target_text := opts[idx_new];
    opts[idx_new] := correct_text;
    opts[idx_correct] := target_text;
    UPDATE public.questions
      SET option_a = opts[1], option_b = opts[2], option_c = opts[3], option_d = opts[4],
          correct_option = new_pos
      WHERE id = q.id;
  END LOOP;
END $$;

-- 20260702232526_67adbe5f-52b9-40e1-a439-7ebb8e7efc9a.sql
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS skill_tags text[] NOT NULL DEFAULT '{}';

-- 20260702234729_f5221d68-f113-40b7-9212-f4b5a1892d6d.sql


-- 20260702234815_0e2225f2-48fb-40f1-912f-dcc4fa43b5e0.sql

-- =========================================================
-- EVALUATIONS
-- =========================================================
DROP POLICY IF EXISTS "evaluations public read" ON public.evaluations;
DROP POLICY IF EXISTS "evaluations public insert" ON public.evaluations;

CREATE POLICY "team read evaluations" ON public.evaluations
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'recruiter'::public.app_role)
  );

REVOKE INSERT, UPDATE, DELETE ON public.evaluations FROM anon;

-- =========================================================
-- EVALUATION_RESULTS
-- =========================================================
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='evaluation_results' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.evaluation_results', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "team read evaluation results" ON public.evaluation_results
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'recruiter'::public.app_role)
  );

CREATE POLICY "admin manages evaluation results" ON public.evaluation_results
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON public.evaluation_results FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_results TO authenticated;
GRANT ALL ON public.evaluation_results TO service_role;

-- =========================================================
-- EVALUATION_ANSWERS
-- =========================================================
DROP POLICY IF EXISTS "eval answers public insert" ON public.evaluation_answers;
DROP POLICY IF EXISTS "eval answers admin read" ON public.evaluation_answers;

CREATE POLICY "team read eval answers" ON public.evaluation_answers
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'recruiter'::public.app_role)
  );

REVOKE INSERT, UPDATE, DELETE ON public.evaluation_answers FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.evaluation_answers FROM authenticated;
GRANT SELECT ON public.evaluation_answers TO authenticated;
GRANT ALL ON public.evaluation_answers TO service_role;

-- =========================================================
-- CANDIDATES
-- =========================================================
DROP POLICY IF EXISTS "admins read candidates" ON public.candidates;
DROP POLICY IF EXISTS "team read candidates" ON public.candidates;
CREATE POLICY "team read candidates" ON public.candidates
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'recruiter'::public.app_role)
  );

-- =========================================================
-- APPLICATIONS
-- =========================================================
DROP POLICY IF EXISTS "Public can submit applications" ON public.applications;
CREATE POLICY "Public can submit applications" ON public.applications
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    candidate_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = candidate_id)
    AND jsonb_typeof(respuestas) = 'object'
    AND status = 'nuevo'::public.application_status
    AND vacancy_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.vacancies v WHERE v.id = vacancy_id AND v.is_active = true)
  );

DROP POLICY IF EXISTS "admins read applications" ON public.applications;
DROP POLICY IF EXISTS "team read applications" ON public.applications;
CREATE POLICY "team read applications" ON public.applications
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'recruiter'::public.app_role)
  );

DROP POLICY IF EXISTS "admins update applications" ON public.applications;
DROP POLICY IF EXISTS "team update applications" ON public.applications;
CREATE POLICY "team update applications" ON public.applications
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'recruiter'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'recruiter'::public.app_role)
  );

-- =========================================================
-- UPLOADS
-- =========================================================
DROP POLICY IF EXISTS "Public can submit uploads" ON public.uploads;
CREATE POLICY "Public can submit uploads" ON public.uploads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    candidate_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = candidate_id)
    AND cv_url IS NOT NULL
    AND length(trim(cv_url)) > 0
    AND cv_url LIKE (candidate_id::text || '/%')
    AND (video_url IS NULL OR video_url LIKE (candidate_id::text || '/%'))
  );

DROP POLICY IF EXISTS "admins read uploads" ON public.uploads;
DROP POLICY IF EXISTS "team read uploads" ON public.uploads;
CREATE POLICY "team read uploads" ON public.uploads
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'recruiter'::public.app_role)
  );

-- =========================================================
-- VACANCIES
-- =========================================================
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='vacancies' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.vacancies', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "anyone reads active vacancies" ON public.vacancies
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'recruiter'::public.app_role)
  );

CREATE POLICY "admin manages vacancies" ON public.vacancies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- =========================================================
-- QUESTIONS: only visible to team; candidates receive via SECURITY DEFINER RPC
-- =========================================================
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='questions' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.questions', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "team reads questions" ON public.questions
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'recruiter'::public.app_role)
  );

CREATE POLICY "admin manages questions" ON public.questions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE SELECT ON public.questions FROM anon;

-- =========================================================
-- STORAGE: restrict uploads to <candidate_uuid>/ folder
-- =========================================================
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname ILIKE '%application%' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "candidate uploads to own folder" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'applications'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "team reads application files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'applications'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'recruiter'::public.app_role)
    )
  );

CREATE POLICY "admin manages application files" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'applications' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'applications' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- =========================================================
-- Helper RPC so the candidate's post-evaluation page can confirm existence
-- without exposing any evaluation data.
-- =========================================================
CREATE OR REPLACE FUNCTION public.evaluation_exists(_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.evaluations WHERE id = _id);
$$;

REVOKE ALL ON FUNCTION public.evaluation_exists(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluation_exists(uuid) TO anon, authenticated;

-- 20260702234836_17e18e21-b424-46aa-98d5-04f44b9e982e.sql

-- Trigger and helper functions do NOT need to be executable via the API.
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Admin-only maintenance function: finalize_evaluation still needs to be called
-- by anon (the candidate finishes their own exam), but restrict the rest.
-- All *evaluation* RPCs validate state internally (status='in_progress'), so
-- keeping them callable by anon is required by the anonymous candidate flow.

-- 20260702235959_97133410-0260-471a-ab5e-a6e9b1d5a3c6.sql
GRANT SELECT ON public.vacancies TO anon, authenticated;
GRANT ALL ON public.vacancies TO service_role;

-- 20260703000333_2fee8d72-ea0a-413f-aab6-2f920cfc87d9.sql
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;

-- 20260703164201_4124240c-4cb8-4735-bde3-8d227c1eee38.sql

-- Fix: EXISTS subqueries against public.candidates in WITH CHECK policies fail for anon
-- because anon lacks SELECT on candidates. FK constraints already guarantee existence.

DROP POLICY IF EXISTS "Public can submit applications" ON public.applications;
CREATE POLICY "Public can submit applications" ON public.applications
FOR INSERT TO anon, authenticated
WITH CHECK (
  candidate_id IS NOT NULL
  AND vacancy_id IS NOT NULL
  AND jsonb_typeof(respuestas) = 'object'
  AND status = 'nuevo'::application_status
  AND EXISTS (SELECT 1 FROM public.vacancies v WHERE v.id = applications.vacancy_id AND v.is_active = true)
);

DROP POLICY IF EXISTS "Public can submit uploads" ON public.uploads;
CREATE POLICY "Public can submit uploads" ON public.uploads
FOR INSERT TO anon, authenticated
WITH CHECK (
  candidate_id IS NOT NULL
  AND cv_url IS NOT NULL
  AND length(trim(cv_url)) > 0
  AND cv_url LIKE (candidate_id::text || '/%')
  AND (video_url IS NULL OR video_url LIKE (candidate_id::text || '/%'))
);

-- Also allow anon to read active vacancies through the subquery (needed by applications policy)
-- The existing vacancies SELECT policy already permits anon to read active rows, so the
-- EXISTS on vacancies works. Nothing more to change there.

-- Storage: same EXISTS-on-candidates issue for the upload policy.
DROP POLICY IF EXISTS "candidate uploads to own folder" ON storage.objects;
CREATE POLICY "candidate uploads to own folder" ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'applications'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

-- 20260706170739_8c85beea-b82b-477b-bf91-8f24705f2720.sql
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS accepted_privacy_policy boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy_policy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_policy_version text;

-- 20260706173131_6a5aa2f8-d026-462a-9066-27e2268ca3d2.sql

-- =========================================================
-- PROFILES (unique candidate profile per authenticated user)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text,
  email text,
  telefono text,
  ciudad text,
  linkedin text,
  experiencia integer NOT NULL DEFAULT 0,
  cv_url text,
  video_url text,
  skills text[] NOT NULL DEFAULT '{}'::text[],
  evaluation_id uuid REFERENCES public.evaluations(id) ON DELETE SET NULL,
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  accepted_privacy_policy boolean NOT NULL DEFAULT false,
  privacy_policy_accepted_at timestamptz,
  privacy_policy_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, nombre)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- =========================================================
-- APPLICATIONS: link to user + reused evaluation
-- =========================================================
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evaluation_id uuid REFERENCES public.evaluations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS applications_user_id_idx ON public.applications(user_id);

-- Allow candidate_id to be NULL now that profiles are the source of truth
ALTER TABLE public.applications ALTER COLUMN candidate_id DROP NOT NULL;

DROP POLICY IF EXISTS "Users can view own applications" ON public.applications;
CREATE POLICY "Users can view own applications" ON public.applications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own applications" ON public.applications;
CREATE POLICY "Users can create own applications" ON public.applications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND vacancy_id IS NOT NULL);

-- =========================================================
-- EVALUATIONS: link to user + read own
-- =========================================================
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS evaluations_user_id_idx ON public.evaluations(user_id);

DROP POLICY IF EXISTS "Users can view own evaluations" ON public.evaluations;
CREATE POLICY "Users can view own evaluations" ON public.evaluations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own evaluation answers" ON public.evaluation_answers;
CREATE POLICY "Users can view own evaluation answers" ON public.evaluation_answers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_id AND e.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view own evaluation results" ON public.evaluation_results;
CREATE POLICY "Users can view own evaluation results" ON public.evaluation_results
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_id AND e.user_id = auth.uid()));

-- =========================================================
-- apply_to_vacancy RPC: profile-aware, reuses evaluations
-- =========================================================
CREATE OR REPLACE FUNCTION public.apply_to_vacancy(_vacancy_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _profile public.profiles%ROWTYPE;
  _existing_app_id uuid;
  _existing_eval_id uuid;
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

  -- Already applied?
  SELECT id, evaluation_id INTO _existing_app_id, _reused_eval_id
  FROM public.applications
  WHERE user_id = _uid AND vacancy_id = _vacancy_id
  ORDER BY created_at DESC LIMIT 1;

  IF _existing_app_id IS NOT NULL THEN
    -- If it has an evaluation, return it
    IF _reused_eval_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'application_id', _existing_app_id,
        'evaluation_id', _reused_eval_id,
        'reused', true,
        'completed', (SELECT status = 'completed' FROM public.evaluations WHERE id = _reused_eval_id)
      );
    END IF;
  END IF;

  -- Reuse most recent completed evaluation for this user
  SELECT id INTO _reused_eval_id
  FROM public.evaluations
  WHERE user_id = _uid AND status = 'completed'
  ORDER BY finished_at DESC NULLS LAST, updated_at DESC
  LIMIT 1;

  IF _reused_eval_id IS NULL THEN
    -- Start a fresh evaluation tied to the user
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
$$;

GRANT EXECUTE ON FUNCTION public.apply_to_vacancy(uuid) TO authenticated;

-- After finalize, cache eval on profile so future applies reuse it
CREATE OR REPLACE FUNCTION public.cache_evaluation_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.user_id IS NOT NULL THEN
    UPDATE public.profiles SET evaluation_id = NEW.id, updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evaluations_cache_on_profile ON public.evaluations;
CREATE TRIGGER evaluations_cache_on_profile
  AFTER UPDATE OF status ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.cache_evaluation_on_profile();

-- Storage: allow authenticated users to manage files under their user_id folder in "applications"
DROP POLICY IF EXISTS "Authenticated can upload own application files" ON storage.objects;
CREATE POLICY "Authenticated can upload own application files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'applications' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Authenticated can read own application files" ON storage.objects;
CREATE POLICY "Authenticated can read own application files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'applications' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Authenticated can update own application files" ON storage.objects;
CREATE POLICY "Authenticated can update own application files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'applications' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'applications' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Authenticated can delete own application files" ON storage.objects;
CREATE POLICY "Authenticated can delete own application files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'applications' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 20260708184747_f490b9c3-5006-4f1c-9186-e09ad1e9bec9.sql

DO $$ BEGIN
  CREATE TYPE public.question_difficulty AS ENUM ('basic','intermediate','advanced');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS difficulty public.question_difficulty NOT NULL DEFAULT 'intermediate';

DROP FUNCTION IF EXISTS public.get_evaluation_questions(uuid, integer);

CREATE FUNCTION public.get_evaluation_questions(_vacancy_id uuid, _limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, category text, question text,
               option_a text, option_b text, option_c text, option_d text, option_e text,
               difficulty public.question_difficulty, order_index integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT q.id, q.category, q.question,
         q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
         q.difficulty, q.order_index
  FROM public.questions q
  WHERE q.vacancy_id = _vacancy_id
  ORDER BY q.order_index ASC
  LIMIT _limit;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_evaluation(_evaluation_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _total int; _correct int; _avg int; _pct numeric; _score int; _comp text;
BEGIN
  SELECT count(*)::int INTO _total FROM public.questions q
    JOIN public.evaluations e ON e.vacancy_id = q.vacancy_id
    WHERE e.id = _evaluation_id;

  SELECT count(*) FILTER (WHERE is_correct)::int,
         COALESCE(avg(time_ms), 0)::int
  INTO _correct, _avg
  FROM public.evaluation_answers WHERE evaluation_id = _evaluation_id;

  _pct := CASE WHEN _total > 0 THEN round((_correct::numeric / _total) * 100, 2) ELSE 0 END;
  _score := _correct * 5;
  _comp := CASE
    WHEN _pct >= 85 THEN 'excelente'
    WHEN _pct >= 70 THEN 'recomendado'
    WHEN _pct >= 50 THEN 'revision'
    ELSE 'no_compatible'
  END;

  UPDATE public.evaluations SET
    status = 'completed', total_questions = _total, total_correct = _correct,
    percentage = _pct, avg_time_ms = _avg, score = _score, compatibility = _comp,
    finished_at = now(), updated_at = now()
  WHERE id = _evaluation_id;

  RETURN jsonb_build_object('total', _total, 'correct', _correct, 'percentage', _pct, 'score', _score, 'compatibility', _comp);
END; $function$;

DELETE FROM public.questions WHERE vacancy_id IN (
  '00000000-0000-4000-8000-000000000013'::uuid,
  '00000000-0000-4000-8000-000000000011'::uuid,
  '00000000-0000-4000-8000-000000000012'::uuid
);

-- LT GUADALAJARA
INSERT INTO public.questions (vacancy_id, category, difficulty, question, option_a, option_b, option_c, option_d, option_e, correct_option, order_index) VALUES
('00000000-0000-4000-8000-000000000013','Liderazgo','basic','Un asesor llega tarde por tercera vez esta semana. ¿Qué haces primero?','Llamarle la atención frente al equipo','Reunión 1:1 breve para entender la causa y acordar plan','Reportarlo a RH de inmediato','Ignorarlo si cumple metas','Reducirle cartera como sanción','B',1),
('00000000-0000-4000-8000-000000000013','Indicadores','basic','Como Líder Territorial, tu KPI principal es:','Horas trabajadas del equipo','Reportes enviados a corporativo','Producción y crecimiento de cartera del territorio','Cantidad de juntas semanales','Antigüedad promedio del equipo','C',2),
('00000000-0000-4000-8000-000000000013','Coaching','basic','La forma más efectiva de coaching para un asesor nuevo es:','Enviarle manuales por correo','Curso online sin seguimiento','Compararlo con el top del equipo','Acompañamiento en campo con feedback inmediato','Evaluarlo hasta el trimestre siguiente','D',3),
('00000000-0000-4000-8000-000000000013','Sector Asegurador','basic','La retención de cartera se mide típicamente por:','Número de pólizas nuevas','Total de citas agendadas','Ranking de vendedores','Reclamaciones pagadas','Índice de renovación de pólizas vigentes','E',4),
('00000000-0000-4000-8000-000000000013','Toma de Decisiones','intermediate','Cierre de mes, vas 15% abajo de meta y tu asesor top pide 3 días libres por tema personal. ¿Qué decides?','Aprobarlos, redistribuir su pipeline crítico y ajustar tu plan de cierre','Negarle los días','Aprobarlos sin ajustar nada','Condicionarlos a que cierre antes','Pedirle que trabaje remoto esos días','A',5),
('00000000-0000-4000-8000-000000000013','Resolución de Conflictos','intermediate','Dos asesores se disputan un mismo prospecto. ¿Qué haces?','Se lo asignas al que llegó primero sin verificar','Lo divides en comisiones al 50/50','Revisas CRM/reglas de asignación y decides con base en evidencia','Lo tomas tú directamente','Dejas que el prospecto elija','C',6),
('00000000-0000-4000-8000-000000000013','Desarrollo de Talento','intermediate','Un asesor con potencial lleva 3 meses estancado. ¿Qué haces primero?','Reemplazarlo','Aumentarle la cuota para presionarlo','Cambiarlo de territorio','Reducirle comisión','Diagnóstico de causa (pipeline, técnica, motivación) y plan a 30 días','E',7),
('00000000-0000-4000-8000-000000000013','Planeación Estratégica','intermediate','Tu territorio depende 70% de un solo canal. ¿Qué haces?','Diversificar activando 1-2 canales adicionales con metas claras','Mantener la concentración porque funciona','Abandonar el canal actual','Duplicar inversión en ese canal','Esperar instrucciones de dirección','A',8),
('00000000-0000-4000-8000-000000000013','Seguimiento de Metas','intermediate','A mitad de mes el equipo va al 55% de meta. ¿Qué priorizas?','Prospectar leads nuevos desde cero','Revisar pipeline por asesor y reactivar oportunidades calientes','Bajar la meta con dirección','Convocar junta motivacional','Esperar cierre natural','B',9),
('00000000-0000-4000-8000-000000000013','Coaching','intermediate','Un asesor tiene muchas citas pero cierra pocas pólizas. ¿Qué refuerzas?','Prospección','Presentación institucional','Horario de trabajo','Técnica de cierre y manejo de objeciones','Base de datos','D',10),
('00000000-0000-4000-8000-000000000013','Liderazgo Comercial','intermediate','Un cliente clave pide condiciones fuera de política. ¿Qué haces?','Aceptar para no perderlo','Rechazar sin explicación','Delegarlo al asesor','Prometerlo y ajustar después','Escalar con áreas técnica/comercial y proponer alternativa dentro de política','E',11),
('00000000-0000-4000-8000-000000000013','Indicadores','intermediate','¿Qué indicador te alerta primero de un problema de calidad de cartera?','Ventas nuevas','Tasa de cancelación temprana en los primeros 3 meses','Cotizaciones emitidas','NPS anual','Comisiones pagadas','B',12),
('00000000-0000-4000-8000-000000000013','Gestión de Equipos','intermediate','Un asesor supera metas pero afecta el clima del equipo. ¿Qué haces?','Ignorarlo porque produce','Despedirlo de inmediato','1:1 directo con expectativas de conducta, consecuencias y plan de mejora','Cambiarlo de equipo','Reducirle comisión','C',13),
('00000000-0000-4000-8000-000000000013','Planeación','intermediate','Al planear el trimestre, ¿por dónde empiezas?','Definir cuotas por asesor sin análisis','Copiar el plan del trimestre anterior','Analizar cartera actual, pipeline y capacidad instalada; luego fijar cuotas','Preguntar a cada asesor su meta ideal','Esperar cuota de dirección','C',14),
('00000000-0000-4000-8000-000000000013','Retención de Talento','advanced','Tu mejor asesor recibe oferta de la competencia con 20% más. ¿Qué haces?','Igualar el sueldo sin análisis','Dejarlo ir','Aumentar sueldo a todo el equipo','Evaluar motivaciones no salariales y proponer contraoferta integral con retención condicionada','Acelerar su ascenso sin evaluar','D',15),
('00000000-0000-4000-8000-000000000013','Estrategia','advanced','La competencia bajó precios 10% en tu plaza. ¿Qué haces?','Reforzar propuesta de valor y segmentar clientes por sensibilidad al precio','Bajar precios igual','Aumentar comisiones al equipo','Pausar prospección','Reportar a dirección y esperar','A',16),
('00000000-0000-4000-8000-000000000013','Gestión de Crisis','advanced','Un asesor comete un error grave que afecta a un cliente clave. ¿Qué haces primero?','Sancionar públicamente al asesor','Contener al cliente, asumir responsabilidad como líder y luego trabajar causa raíz con el asesor','Ocultarlo a dirección','Pedirle al asesor que lo resuelva solo','Cambiar al cliente de asesor sin explicar','B',17),
('00000000-0000-4000-8000-000000000013','Desarrollo de Talento','advanced','¿Cuál es la señal más confiable de que un asesor está listo para ser gerente?','Tiene la mayor producción individual','Lleva más antigüedad','Desarrolla a otros y sus resultados no dependen solo de él','Tiene mejor relación contigo','Pide el ascenso','C',18),
('00000000-0000-4000-8000-000000000013','Análisis de Indicadores','advanced','Producción sube 15% pero rentabilidad cae. ¿Qué revisas primero?','Volumen de citas','Horario del equipo','NPS','Rotación','Mix de producto, siniestralidad y descuentos aplicados','E',19),
('00000000-0000-4000-8000-000000000013','Liderazgo Estratégico','advanced','Tu jefe fija una meta que consideras irreal. ¿Qué haces?','Aceptarla sin cuestionar','Presentar análisis con supuestos, riesgos y propuesta alterna basada en datos','Rechazarla frente al equipo','Transmitirla al equipo sin filtro','Renunciar','B',20);

-- DESARROLLO COMERCIAL QUERÉTARO
INSERT INTO public.questions (vacancy_id, category, difficulty, question, option_a, option_b, option_c, option_d, option_e, correct_option, order_index) VALUES
('00000000-0000-4000-8000-000000000011','Prospección','basic','El mejor primer paso para abrir un mercado nuevo es:','Enviar cotizaciones masivas','Mapear cuentas objetivo y perfil del decisor','Publicar en redes sociales','Bajar precios','Esperar referidos','B',1),
('00000000-0000-4000-8000-000000000011','Seguimiento','basic','Un prospecto pide "más información". ¿Qué haces?','Enviar brochure y esperar','Agendar una fecha concreta de seguimiento antes de colgar','Marcarlo como perdido','Reenviar la misma propuesta','Escalarlo al jefe','B',2),
('00000000-0000-4000-8000-000000000011','Atención al Cliente','basic','Frente a una queja de un cliente activo, tu prioridad es:','Justificar por qué ocurrió','Culpar al área operativa','Escuchar, confirmar entendimiento y comprometer acción con fecha','Ofrecer un descuento inmediato','Delegarlo sin dar seguimiento','C',3),
('00000000-0000-4000-8000-000000000011','Orientación a Resultados','basic','Tu métrica de éxito principal en Desarrollo Comercial es:','Número de correos enviados','Cantidad de llamadas realizadas','Reuniones agendadas','Ingresos generados y cuentas nuevas cerradas','Horas en oficina','D',4),
('00000000-0000-4000-8000-000000000011','Manejo de Objeciones','intermediate','Cliente: "Está muy caro comparado con otra opción". ¿Qué respondes?','"Puedo bajarle el precio"','"Entiendo, ¿qué está comparando y qué es lo más importante para usted en la decisión?"','"Esa opción no sirve"','"Es nuestro precio, no puedo hacer nada"','"Déjeme consultar y le regreso llamada"','B',5),
('00000000-0000-4000-8000-000000000011','Negociación','intermediate','En una negociación estancada por precio, ¿qué haces primero?','Ceder para cerrar','Explorar variables distintas al precio (plazo, alcance, pago, servicios)','Retirar la propuesta','Subir precio para negociar a la baja','Presionar con urgencia falsa','B',6),
('00000000-0000-4000-8000-000000000011','Apertura de Mercado','intermediate','Llegas a Querétaro sin cartera. ¿Cuál es tu prioridad los primeros 30 días?','Cerrar cualquier cliente disponible','Mapear industria/segmentos objetivo, decisores y aliados clave','Enviar 500 correos en frío','Bajar tarifas para ganar mercado','Esperar leads del corporativo','B',7),
('00000000-0000-4000-8000-000000000011','Alianzas','intermediate','Un potencial aliado quiere co-vender pero exige exclusividad regional. ¿Qué haces?','Aceptar de inmediato','Rechazar sin analizar','Evaluar potencial, medir riesgo de exclusividad y negociar términos con métricas y cláusula de salida','Aceptar solo verbalmente','Escalarlo sin recomendación','C',8),
('00000000-0000-4000-8000-000000000011','Prospección','intermediate','¿Qué prospecto priorizas cuando tu tiempo es limitado?','El más simpático','El que te contestó primero','El más grande sin importar fit','El que tiene necesidad clara, presupuesto y decisor identificado','El referido por un amigo','D',9),
('00000000-0000-4000-8000-000000000011','Seguimiento Comercial','intermediate','Un prospecto caliente dejó de contestar 2 semanas. ¿Qué haces?','Marcarlo como perdido','Insistir con la misma llamada diaria','Cambiar de canal, aportar valor nuevo (caso, dato) y proponer próximo paso concreto','Enviarle la misma propuesta otra vez','Esperar que él regrese','C',10),
('00000000-0000-4000-8000-000000000011','Planeación Comercial','intermediate','Tienes 20 cuentas objetivo y tiempo para 10. ¿Cómo eliges?','Alfabéticamente','Las de mayor cercanía geográfica','Las que ya conoces','Priorizar por potencial de ingreso, probabilidad y encaje con tu propuesta','Al azar','D',11),
('00000000-0000-4000-8000-000000000011','Desarrollo de Cartera','intermediate','Un cliente PYME compra 1 producto. ¿Cómo lo desarrollas?','Ofrecerle descuento en lo mismo','Diagnosticar necesidades adyacentes y proponer cobertura complementaria basada en su riesgo','Esperar que pida más','Presionar para renovar antes de tiempo','Ofrecerle todos los productos del catálogo','B',12),
('00000000-0000-4000-8000-000000000011','Cierre','intermediate','En la reunión de cierre, el decisor duda al final. ¿Qué haces?','Presionar diciendo que la oferta expira hoy','Recular y ofrecer descuento','Callar y esperar','Explorar la duda concreta con una pregunta abierta antes de proponer el cierre','Cerrar la reunión y esperar semanas','D',13),
('00000000-0000-4000-8000-000000000011','Manejo de Objeciones','intermediate','Cliente dice "lo tengo que pensar". El siguiente paso más efectivo es:','Aceptar y colgar','Preguntar qué necesita resolver específicamente para tomar decisión y acordar fecha','Ofrecer descuento','Insistir con testimonios','Reenviar propuesta','B',14),
('00000000-0000-4000-8000-000000000011','Estrategia Comercial','advanced','Detectas un segmento nuevo con potencial pero fuera de tu propuesta actual. ¿Qué haces?','Ignorarlo y enfocarte en lo actual','Validar con 3-5 clientes potenciales antes de proponer inversión y ajuste de propuesta','Lanzar de inmediato','Delegarlo a otro','Escalar sin evidencia','B',15),
('00000000-0000-4000-8000-000000000011','Negociación Avanzada','advanced','El cliente exige un descuento del 25%. Tu margen sano tolera 10%. ¿Qué haces?','Aceptar y absorber la pérdida','Negarte sin alternativa','Reestructurar la propuesta (alcance, plazo, servicios) para preservar margen y ofrecer valor equivalente','Aceptar y recuperarlo después con letras chicas','Escalar sin propuesta','C',16),
('00000000-0000-4000-8000-000000000011','Cuentas Estratégicas','advanced','Un cliente clave amenaza con irse por servicio. ¿Cuál es tu primer movimiento?','Ofrecer descuento inmediato','Recuperar hechos, agendar reunión con el decisor y presentar plan de servicio con métricas y responsables','Cambiarle de asesor sin avisar','Aceptar la salida','Escalarlo a legal','B',17),
('00000000-0000-4000-8000-000000000011','Pipeline','advanced','Tu pipeline es grande pero cierras poco. ¿Qué revisas primero?','Número de reuniones','Presupuesto en marketing','Calidad de calificación (fit, presupuesto, decisor, timing) y etapa donde se pierden','Guion de llamadas','Precios de la competencia','C',18),
('00000000-0000-4000-8000-000000000011','Alianzas','advanced','Un aliado te genera volumen pero baja tu margen 40%. ¿Qué haces?','Cortar la alianza','Mantenerla igual','Renegociar tarifas y mix de producto o segmentar cuentas donde sí conviene','Subir precios a esos clientes en silencio','Escalarlo sin datos','C',19),
('00000000-0000-4000-8000-000000000011','Toma de Decisiones','advanced','Tienes 3 oportunidades: A grande baja probabilidad, B mediana alta probabilidad, C chica cierre inmediato. Recursos solo para 2. ¿Cuáles?','A y C','A y B','B y C','Solo A','Solo B','C',20);

-- DESARROLLO COMERCIAL GUADALAJARA
INSERT INTO public.questions (vacancy_id, category, difficulty, question, option_a, option_b, option_c, option_d, option_e, correct_option, order_index) VALUES
('00000000-0000-4000-8000-000000000012','Venta Consultiva','basic','En venta consultiva, tu primer objetivo en la reunión inicial es:','Cerrar la venta','Presentar todo el catálogo','Comprender el negocio y los riesgos del cliente','Ofrecer el mejor precio','Mostrar credenciales','C',1),
('00000000-0000-4000-8000-000000000012','Prospección','basic','El canal más efectivo para prospectar clientes empresariales suele ser:','Llamadas frías masivas','Referencias, LinkedIn y networking dirigido a decisores','Volantes','Anuncios genéricos','Correo masivo sin segmentar','B',2),
('00000000-0000-4000-8000-000000000012','Organización','basic','Al inicio del día tu prioridad es:','Revisar redes sociales','Contestar todos los correos','Definir las 3 acciones que más mueven el pipeline hoy','Actualizar el CRM','Agendar más juntas','C',3),
('00000000-0000-4000-8000-000000000012','Cumplimiento','basic','No vas a alcanzar la meta del mes. ¿Qué haces?','Ocultarlo hasta el cierre','Buscar culpables','Bajar el objetivo tú mismo','Comunicar temprano con causas, plan de recuperación y compromiso realista','Renunciar a la meta','D',4),
('00000000-0000-4000-8000-000000000012','Priorización','intermediate','Cliente A: alto potencial, decisión en 6 meses. Cliente B: bajo potencial, decisión esta semana. Solo tienes hoy. ¿Qué haces?','Cerrar B y programar avance concreto con A','Ignorar B','Reunirte con A todo el día','Postergar ambos','Delegar los dos','A',5),
('00000000-0000-4000-8000-000000000012','Ventas Consultivas','intermediate','Cliente empresarial dice: "ya tenemos proveedor". ¿Qué haces?','Retirarte','Bajar precio','Explorar qué le gusta y qué mejoraría; ofrecer diagnóstico sin costo enfocado en un gap','Criticar al proveedor actual','Insistir con tu catálogo','C',6),
('00000000-0000-4000-8000-000000000012','Negociación','intermediate','El decisor pide 60 días de crédito; la política son 30. ¿Qué haces?','Aceptar sin autorización','Rechazar sin alternativa','Escalarlo pero primero validar volumen, historial y proponer términos intermedios con garantías','Ofrecer descuento','Retirar la propuesta','C',7),
('00000000-0000-4000-8000-000000000012','Seguimiento','intermediate','Después de una propuesta enviada, ¿cuándo es el momento óptimo de seguimiento?','Cuando el cliente responda','Cada día hasta que conteste','En la fecha concreta acordada al final de la reunión','A los 30 días','Nunca, para no incomodar','C',8),
('00000000-0000-4000-8000-000000000012','Clientes Empresariales','intermediate','En una cuenta empresarial identificas 4 involucrados. ¿A quién priorizas?','Al más amable','Al usuario final únicamente','A quien tiene poder de decisión y a quien puede vetar','A quien te devuelve las llamadas','Al de mayor puesto sin importar rol','C',9),
('00000000-0000-4000-8000-000000000012','Capacidad Analítica','intermediate','Un cliente pide cobertura amplia con costo bajo. ¿Qué haces?','Aceptar ambos requisitos','Rechazar sin analizar','Cuantificar el riesgo, mostrar trade-offs y proponer 2 escenarios comparados','Reducir cobertura sin avisar','Copiar la póliza de otro cliente','C',10),
('00000000-0000-4000-8000-000000000012','Manejo de Objeciones','intermediate','Cliente: "necesito consultarlo con el corporativo". ¿Qué haces?','Aceptar y esperar semanas','Ofrecerte a presentar directamente al corporativo con material listo y fecha propuesta','Bajar el precio para que decida solo','Escalar a tu jefe','Retirar la propuesta','B',11),
('00000000-0000-4000-8000-000000000012','Organización','intermediate','Tu CRM tiene 80 oportunidades abiertas y no trabajas todas. ¿Qué haces?','Trabajarlas todas superficialmente','Cerrarlas todas como perdidas','Segmentar por probabilidad y valor, descartar frías y enfocar el top 20','Ignorarlas y prospectar más','Delegar todo','C',12),
('00000000-0000-4000-8000-000000000012','Desarrollo de Relaciones','intermediate','Cerraste con un cliente empresarial. ¿Cuál es tu siguiente movimiento?','Pasar al siguiente prospecto','Esperar la renovación','Diseñar plan de servicio de 90 días con checkpoints y buscar expansión temprana','Enviarle catálogo completo','Pedirle referidos de inmediato','C',13),
('00000000-0000-4000-8000-000000000012','Cumplimiento','intermediate','Vas 50% de meta trimestral en el mes 2. ¿Qué haces?','Trabajar más horas','Revisar tasa de conversión por etapa, priorizar oportunidades cerca de cierre y acelerar top del pipeline','Prospectar más de todo','Reportar imposibilidad','Ofrecer descuentos generales','B',14),
('00000000-0000-4000-8000-000000000012','Ventas Consultivas','advanced','Detectas que la necesidad real del cliente es distinta a la que él pide. ¿Qué haces?','Vender lo que pidió y punto','Rechazar la oportunidad','Presentar diagnóstico con hallazgos, riesgos cuantificados y recomendación aunque implique menor venta hoy','Reportarlo a tu jefe','Ofrecer ambas soluciones','C',15),
('00000000-0000-4000-8000-000000000012','Negociación Estratégica','advanced','Cuenta grande pide un contrato marco con cláusulas duras. ¿Qué haces?','Firmar como llegó','Rechazar sin más','Marcar cláusulas críticas (SLA, penalizaciones, exclusividad, salida), coordinar con legal y contra-proponer','Delegar sin leer','Firmar solo la parte comercial','C',16),
('00000000-0000-4000-8000-000000000012','Capacidad Analítica','advanced','Un cliente empresarial tiene siniestralidad alta. ¿Cómo abordas la renovación?','Subir prima sin explicar','No renovar','Analizar causas de siniestros, proponer plan de prevención con incentivos y ajuste técnico de prima','Mantener condiciones para no perderlo','Cambiarlo a otro producto sin análisis','C',17),
('00000000-0000-4000-8000-000000000012','Cuentas Estratégicas','advanced','Compites contra un incumbente muy fuerte. ¿Cuál es tu mejor estrategia?','Bajar precio agresivamente','Encontrar un dolor específico no atendido y ganar credibilidad ahí primero','Copiar su propuesta','Atacar al incumbente frontalmente','Esperar que se equivoque','B',18),
('00000000-0000-4000-8000-000000000012','Toma de Decisiones','advanced','Prospecto pide reunión urgente pero pisa un cierre confirmado con otro cliente. ¿Qué haces?','Cancelar el cierre','Ignorar al prospecto','Mantener el cierre y proponer al prospecto 2 alternativas concretas en las próximas 48h con material previo','Enviar a alguien más al cierre','Reagendar ambos','C',19),
('00000000-0000-4000-8000-000000000012','Cumplimiento','advanced','Cierre de trimestre: cerrar hoy con descuento fuera de política o cerrar la siguiente semana con condiciones sanas. ¿Qué haces?','Cerrar hoy con descuento no autorizado','Cerrar la próxima semana con condiciones sanas y comunicar impacto al forecast','Cerrar hoy y pedir perdón después','Cancelar la oportunidad','Escalar sin decisión','B',20);

-- 20260713170845_d5dced60-6fc7-47ce-bd08-82014b51e5ad.sql

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

-- 20260713180922_81374e54-3193-400b-989f-84a92207215a.sql
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

-- 20260713181010_cdc7ccb0-fb62-4f97-9ffd-4b905699ba9a.sql
REVOKE EXECUTE ON FUNCTION public.apply_to_vacancy(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_to_vacancy(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_to_vacancy(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_to_vacancy(uuid) TO service_role;
CREATE TYPE public.aj_modality AS ENUM ('presencial','remoto','hibrido');
ALTER TABLE public.vacancies
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS ramos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pay_scheme text,
  ADD COLUMN IF NOT EXISTS salary_text text,
  ADD COLUMN IF NOT EXISTS cedula text NOT NULL DEFAULT 'No requiere',
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS modality public.aj_modality,
  ADD COLUMN IF NOT EXISTS requirements text,
  ADD COLUMN IF NOT EXISTS benefits text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'activa',
  ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS resumen text,
  ADD COLUMN IF NOT EXISTS ramos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS certificaciones text[] NOT NULL DEFAULT '{}';
GRANT INSERT, UPDATE ON public.vacancies TO authenticated;
DROP POLICY IF EXISTS "Recruiters manage vacancies" ON public.vacancies;
CREATE POLICY "Recruiters manage vacancies" ON public.vacancies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recruiter'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recruiter'));
ALTER TABLE public.vacancies ADD COLUMN IF NOT EXISTS company_logo_url text;
ALTER TABLE public.vacancies ADD CONSTRAINT vacancies_company_logo_size CHECK (company_logo_url IS NULL OR length(company_logo_url) <= 500000);
-- Run once in Supabase SQL Editor before using open company registration.
-- Each recruiter owns their vacancies. Existing unowned vacancies stay admin-managed.


ALTER TABLE public.vacancies ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.vacancies ALTER COLUMN created_by SET DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS vacancies_created_by_idx ON public.vacancies(created_by);
GRANT INSERT, UPDATE, DELETE ON public.vacancies TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_vacancy(_vacancy_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR (
    public.has_role(auth.uid(), 'recruiter') AND EXISTS (
      SELECT 1 FROM public.vacancies WHERE id = _vacancy_id AND created_by = auth.uid()
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_applicant(_user_id uuid, _candidate_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR (
    public.has_role(auth.uid(), 'recruiter') AND EXISTS (
      SELECT 1 FROM public.applications a JOIN public.vacancies v ON v.id = a.vacancy_id
      WHERE v.created_by = auth.uid()
        AND ((_user_id IS NOT NULL AND a.user_id = _user_id)
          OR (_candidate_id IS NOT NULL AND a.candidate_id = _candidate_id))
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_company_evaluation(_evaluation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.evaluations e WHERE e.id = _evaluation_id
      AND (e.user_id = auth.uid() OR public.can_manage_vacancy(e.vacancy_id))
  ) OR EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.evaluation_id = _evaluation_id AND public.can_manage_vacancy(a.vacancy_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_company_file(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (p.cv_url = _name OR p.video_url = _name)
      AND (p.user_id = auth.uid() OR public.can_read_applicant(p.user_id, p.candidate_id))
  ) OR EXISTS (
    SELECT 1 FROM public.uploads u
    WHERE (u.cv_url = _name OR u.video_url = _name)
      AND public.can_read_applicant(NULL, u.candidate_id)
  ) OR split_part(_name, '/', 1) = auth.uid()::text;
$$;

REVOKE ALL ON FUNCTION public.can_manage_vacancy(uuid), public.can_read_applicant(uuid, uuid),
  public.can_read_company_evaluation(uuid), public.can_read_company_file(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_vacancy(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_applicant(uuid, uuid),
  public.can_read_company_evaluation(uuid), public.can_read_company_file(text) TO authenticated;

DROP POLICY IF EXISTS "recruiters manage own vacancies" ON public.vacancies;
CREATE POLICY "recruiters manage own vacancies" ON public.vacancies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'recruiter') AND created_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'recruiter') AND created_by = auth.uid());
DROP POLICY IF EXISTS "anyone reads active vacancies" ON public.vacancies;
CREATE POLICY "anyone reads active vacancies" ON public.vacancies FOR SELECT TO anon, authenticated
  USING (is_active OR public.can_manage_vacancy(id));

-- Restrictive policies also constrain existing permissive recruiter policies.
DROP POLICY IF EXISTS "company application read scope" ON public.applications;
CREATE POLICY "company application read scope" ON public.applications AS RESTRICTIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_vacancy(vacancy_id));
DROP POLICY IF EXISTS "company application update scope" ON public.applications;
CREATE POLICY "company application update scope" ON public.applications AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.can_manage_vacancy(vacancy_id)) WITH CHECK (public.can_manage_vacancy(vacancy_id));
DROP POLICY IF EXISTS "company candidate scope" ON public.candidates;
CREATE POLICY "company candidate scope" ON public.candidates AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_read_applicant(NULL, id));
DROP POLICY IF EXISTS "company upload scope" ON public.uploads;
CREATE POLICY "company upload scope" ON public.uploads AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_read_applicant(NULL, candidate_id));
DROP POLICY IF EXISTS "company evaluation scope" ON public.evaluations;
CREATE POLICY "company evaluation scope" ON public.evaluations AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_read_company_evaluation(id));
DROP POLICY IF EXISTS "company result scope" ON public.evaluation_results;
CREATE POLICY "company result scope" ON public.evaluation_results AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_read_company_evaluation(evaluation_id));
DROP POLICY IF EXISTS "company answer scope" ON public.evaluation_answers;
CREATE POLICY "company answer scope" ON public.evaluation_answers AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_read_company_evaluation(evaluation_id));
DROP POLICY IF EXISTS "company question scope" ON public.questions;
CREATE POLICY "company question scope" ON public.questions AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_manage_vacancy(vacancy_id));
DROP POLICY IF EXISTS "company applicant profiles" ON public.profiles;
CREATE POLICY "company applicant profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.can_read_applicant(user_id, candidate_id));
DROP POLICY IF EXISTS "company profile scope" ON public.profiles;
CREATE POLICY "company profile scope" ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_read_applicant(user_id, candidate_id));
DROP POLICY IF EXISTS "company application file scope" ON storage.objects;
CREATE POLICY "company application file scope" ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
  USING (bucket_id <> 'applications' OR public.can_read_company_file(name));

-- A recruiter can change the pipeline status, never the applicant or vacancy identity.
CREATE OR REPLACE FUNCTION public.protect_application_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Trusted SECURITY DEFINER application RPCs run as their database owner.
  IF current_user IN ('authenticated', 'anon') AND auth.uid() IS NOT NULL
    AND NOT public.has_role(auth.uid(), 'admin') AND (
    NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.candidate_id IS DISTINCT FROM OLD.candidate_id
    OR NEW.vacancy_id IS DISTINCT FROM OLD.vacancy_id OR NEW.evaluation_id IS DISTINCT FROM OLD.evaluation_id
    OR NEW.respuestas IS DISTINCT FROM OLD.respuestas
  ) THEN RAISE EXCEPTION 'Only an administrator can change an application identity'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_application_identity ON public.applications;
CREATE TRIGGER protect_application_identity BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.protect_application_identity();

CREATE OR REPLACE FUNCTION public.register_company_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'role' = 'company' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'recruiter')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.register_company_account() FROM PUBLIC;
DROP TRIGGER IF EXISTS register_company_account ON auth.users;
CREATE TRIGGER register_company_account AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.register_company_account();

-- Activate company accounts registered before this migration without granting admin.
INSERT INTO public.user_roles(user_id, role)
SELECT id, 'recruiter'::public.app_role FROM auth.users WHERE raw_user_meta_data->>'role' = 'company'
ON CONFLICT (user_id, role) DO NOTHING;



INSERT INTO storage.buckets(id,name,public) VALUES('applications','applications',false) ON CONFLICT(id) DO NOTHING;
COMMIT;
