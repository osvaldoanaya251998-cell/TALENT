# Métricas, KPI y rotación

En el panel de empresa se incorporan **Métricas y KPI** (`/recruiter/metrics`) y
**Rotación de personal** (`/recruiter/turnover`). Se usan las bibliotecas existentes;
no se activa ningún servicio de pago ni se contrata una API adicional.

## Reclutamiento

Los indicadores consultan las vacantes creadas por la cuenta del reclutador y sus
postulaciones, incluidas las vacantes cerradas. Los administradores también ven
solamente sus propias vacantes en esta sección. La consulta pagina todos los
resultados, sin limitar el total al límite de 1,000 filas de Supabase.

- Filtros por fecha de **postulación** (ambos días incluidos, calendario local del
  navegador) y vacante. El filtro no significa fecha de contratación.
- Total de postulaciones; candidatos identificados sin duplicar perfiles entre
  vacantes; procesos abiertos; contratados y descartados.
- Tasa de contratación = postulaciones actualmente contratadas / postulaciones
  filtradas × 100. La tasa de descarte usa el mismo denominador. Si no hay
  postulaciones, el porcentaje aparece como «—».
- Distribución por etapa **actual**, evolución de postulaciones por mes y tabla
  dinámica agrupable por vacante, etapa o mes, con ordenamiento y exportación CSV.
- Tabla de seguimiento con buscador, filtro de etapa, paginación y acceso al
  resumen y apuntes del candidato. Estos filtros afectan solo esa tabla, no los KPI.

No se presenta un embudo acumulado ni días por etapa: la base actual guarda la
etapa presente, no el historial de todas sus transiciones. Una persona postulada a
dos vacantes representa dos postulaciones y un candidato identificado. Las
postulaciones sin identidad vinculada se señalan y no se inventa una persona por fila.

## Rotación de personal

La empresa captura por mes la plantilla inicial, altas y bajas **reales**. Un
candidato descartado no es una baja laboral y una postulación contratada no se
convierte automáticamente en un empleado registrado.

```text
Plantilla final = plantilla inicial + altas − bajas
Plantilla promedio = (plantilla inicial + plantilla final) / 2
Rotación por bajas (%) = bajas / plantilla promedio × 100
```

Ejemplo: inicio 100, altas 5, bajas 10 → cierre 95, promedio 97.5, rotación 10.26%.
Se impiden cantidades fraccionarias o negativas y cierres negativos. Con promedio
cero el indicador no es calculable, no se sustituye por 0%. Una rotación superior
al 100% es posible si hubo varias sustituciones durante el mes.

La meta mensual es opcional y la define la empresa: «Dentro de meta» significa
rotación ≤ meta; no se supone un porcentaje saludable universal. El dashboard
compara meses guardados y sus metas. Los meses sin registro quedan sin dato. No se
suman ni promedian porcentajes mensuales para inventar una tasa anual.

Cada mes se guarda una vez por cuenta y se puede editar. Cambiar a un mes ya
registrado carga sus datos; cambiar a uno nuevo abre un formulario nuevo. Se
muestra una advertencia si la plantilla inicial difiere del cierre del mes anterior.
Hay notas privadas del período, filtro de año y exportación CSV.

## Activar el historial en el Supabase existente

Los KPI de reclutamiento y la calculadora funcionan con el despliegue de la
aplicación. Para **guardar y recuperar** los períodos de rotación hace falta crear
su tabla una vez en el proyecto de Supabase que utiliza la web:

1. Abre ese proyecto en Supabase → **SQL Editor** → **New query**.
2. Copia **todo** el contenido de
   [`20261021000000_recruiter_workforce_metrics.sql`](../supabase/migrations/20261021000000_recruiter_workforce_metrics.sql).
3. Ejecuta la consulta con **Run** y luego pulsa **Actualizar historial** en la web.

La migración crea únicamente la tabla `recruiter_workforce_periods`, sus
restricciones y políticas. No modifica postulaciones ni datos existentes. Es
repetible. El script para proyectos nuevos `supabase/setup/nuevo-proyecto.sql`
ya la incluye; no ejecutes el script completo de proyecto nuevo en tu base existente.

Sin la tabla, la pantalla explica que el historial aún no está activado; permite
calcular pero deshabilita guardar. Los errores de carga o guardado se muestran sin
convertirlos en cifras cero ni borrar el formulario.

La aplicación no puede crear tablas desde la clave pública del navegador. Esta
migración se entrega para ejecutar desde SQL Editor o el proceso de migraciones
habitual con acceso administrativo; no se deben publicar credenciales de servicio.

## Privacidad y permisos

Las políticas de Supabase restringen cada período a su propietario autenticado
con rol reclutador o administrador. Ni otro reclutador ni un administrador de otra
cuenta pueden leerlo o editarlo; candidatos y visitantes no tienen acceso. Se
mantiene el modelo por cuenta propietaria que ya usa la plataforma para vacantes.

Las notas y nombres privados no se envían al traductor automático. Los CSV se
generan localmente con los filtros vigentes y neutralizan fórmulas en celdas de texto.

## Validación

`cd tests && npm test` verifica cálculos, filtros y permisos sobre PostgreSQL local
(PGlite), incluidas dos empresas, un candidato y un administrador. `npm run
test:browser` verifica dashboards, filtros, exportación, más de 1,000 postulaciones,
resumen, guardado y edición, recuperación tras errores y modo oscuro en celular.
Los servicios remotos se simulan en las pruebas, sin enviar correos ni escribir en
la base de producción.
