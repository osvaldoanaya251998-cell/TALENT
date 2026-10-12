# Avisos por correo de nuevas postulaciones

El reclutador responsable de la vacante recibe este aviso:

```text
Nuevo talento postulado 🎯

• Vacante: {{nombre_vacante}}
• Candidato: {{nombre_candidato}}
• Contacto: {{telefono_candidato}} | {{email_candidato}}

Revisa su perfil y CV completo en tu panel de InsurTalent.
```

El botón **Ver candidato y CV** abre el resumen de esa postulación en el panel.
Si es necesario iniciar sesión como empresa, se conserva el enlace. También se
puede responder al aviso para escribir al candidato. No se incluyen cédulas,
evaluaciones, apuntes privados ni archivos adjuntos del CV; el CV sigue protegido
en el panel.

## Activar el envío sin contratar un plan de pago

El envío se preparó para [Brevo](https://www.brevo.com/es/), que ofrece un plan
gratuito con un límite diario. Comprueba las condiciones vigentes al crear la
cuenta. Esta integración no compra créditos ni cambia automáticamente de plan.
Para este proyecto limita el total de intentos de correo a **100 al día UTC**,
incluidos los reintentos. Los que excedan ese límite permanecen pendientes.
La entrega a la bandeja de entrada depende del proveedor y de los filtros del
destinatario; un proveedor gratuito no garantiza envíos ilimitados.

1. Crea una cuenta gratuita en Brevo. No contrates un plan ni actives recargas.
2. Añade un remitente llamado **InsurTalent** con una dirección tuya y verifica
   esa dirección siguiendo el correo de Brevo. Puedes empezar con un correo
   existente. Si el proveedor pide un dominio propio para autorizar el envío,
   completa ese requisito antes de activar los avisos; esta función no registra
   ni compra dominios. Un dominio propio autenticado mejora la entrega.
3. Crea una **API key** de Brevo para el envío transaccional. La clave se guarda
   como secreto en Cloudflare; no la compartas en el chat ni en GitHub.
4. En el proyecto Supabase que usa la página, abre **SQL Editor** y ejecuta una
   vez [la migración](../supabase/migrations/20261012000000_application_email_notifications.sql).
   Se puede volver a ejecutar sin borrar los avisos. Un proyecto nuevo creado
   con `supabase/setup/nuevo-proyecto.sql` ya la incluye.
5. En Cloudflare abre **Workers & Pages → talent → Settings → Variables and
   Secrets** y configura estos valores del **servidor**, sin prefijo `VITE_`:

| Nombre                       | Tipo     | Valor                                                                                              |
| ---------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`               | Variable | URL del mismo proyecto Supabase que usa la página; reutiliza la existente                          |
| `SUPABASE_SERVICE_ROLE_KEY`  | Secret   | Clave `service_role` o secret de ese mismo proyecto; reutiliza la existente si ya está configurada |
| `BREVO_API_KEY`              | Secret   | Clave de envío de Brevo                                                                            |
| `APPLICATION_EMAIL_FROM`     | Variable | Dirección remitente verificada en Brevo                                                            |
| `APP_PUBLIC_URL`             | Variable | `https://talent.insurtalentmx.workers.dev` o la dirección HTTPS actual de la página                |
| `APPLICATION_EMAILS_ENABLED` | Variable | `true`, solo después de completar los pasos anteriores                                             |

La service role de Supabase tiene permisos elevados: solo debe estar en el
servidor, nunca como variable pública de compilación. Guardar esta configuración
no requiere pegar credenciales en los archivos del proyecto. Publica los cambios
de configuración si Cloudflare lo solicita.

El Worker comprueba la cola cada minuto mediante el cron de `wrangler.jsonc`.
Las credenciales ausentes o el indicador desactivado impiden cualquier envío.
Este cron funciona en Cloudflare Workers; Netlify necesita su propio programador
si se vuelve a utilizar esa plataforma para enviar avisos.

## Elegir el destinatario correcto

Se usa el correo **confirmado de la cuenta Supabase** del propietario de la
vacante (`vacancies.created_by`), con rol de reclutador o administrador. No se
toma de campos escritos por candidatos ni se avisa a otras empresas.
Las vacantes nuevas ya reciben el propietario al publicarlas con sesión de
empresa. Una vacante antigua sin propietario necesita asignarse al reclutador
correcto antes de poder enviar avisos; no se asignan todas las vacantes a una
cuenta por defecto.

Solo se encolan postulaciones insertadas después de ejecutar la migración;
no se importan las anteriores. Los avisos creados a partir de ese momento
permanecen pendientes mientras el envío esté desactivado. Repetir una postulación
existente, cambiar su estado o guardar apuntes no crea otro aviso. La postulación
se guarda sin esperar a Brevo.

## Revisar pendientes y problemas

La cola y sus funciones solo son accesibles al servidor y al administrador de
la base de datos. Para comprobarla en Supabase SQL Editor:

```sql
SELECT status, count(*)
FROM public.application_email_notifications
GROUP BY status;

SELECT id, application_id, status, attempts, last_error, created_at, sent_at
FROM public.application_email_notifications
ORDER BY created_at DESC
LIMIT 30;
```

`sent` significa que Brevo aceptó el mensaje, no que se haya confirmado su
lectura. Ante errores conocidos se conserva el aviso con un plazo de reintento.
Un límite del proveedor pospone el intento 24 horas. Si se pierde la conexión
durante el envío o un proceso termina sin confirmar el resultado, el aviso
queda en `needs_review` para evitar reenviarlo sin saber si ya llegó. Se usa
también una clave de idempotencia estable por aviso en el proveedor.

Corrige primero la causa de `last_error`. Si aparece
`delivery_confirmation_unknown`, revisa los registros transaccionales de Brevo
antes de reintentar. Si aparece `recruiter_unavailable`, comprueba el propietario,
su rol y la confirmación de su correo. Después, para un aviso concreto que has
comprobado que **no se envió**:

```sql
UPDATE public.application_email_notifications
SET status = 'pending', next_attempt_at = now(), last_error = NULL,
    lease_token = NULL, locked_until = NULL
WHERE id = 'ID_DEL_AVISO' AND status = 'needs_review';
```

## Validación

`npm test` desde `tests/` verifica los permisos, destinatarios por empresa,
deduplicación, cola, límite diario, reintentos, plantilla y errores de envío.
Los servicios externos se simulan: las pruebas no envían correos reales.
Las pruebas de navegador comprueban que el enlace abre el candidato indicado,
conserva la sesión o pasa por autenticación, y mantiene los controles de apuntes.
Tras configurar Supabase y Brevo, prueba con una postulación nueva propia y
comprueba el aviso en el correo del reclutador y en los registros de Brevo.
