
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
