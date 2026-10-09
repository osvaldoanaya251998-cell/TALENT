
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
