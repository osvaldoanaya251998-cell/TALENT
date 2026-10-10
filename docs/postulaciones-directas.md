# Postulaciones directas

El candidato envía su perfil y CV y ve la confirmación en la misma página. Los enlaces antiguos a evaluaciones regresan al buscador de empleos. Los paneles conservan la gestión de candidatos, documentos y estados, sin puntajes ni resultados técnicos.

En un proyecto existente, ejecutar una vez en Supabase SQL Editor el archivo `supabase/migrations/20261010000000_direct_applications.sql`. Reemplaza únicamente la función de postulación: deja de crear evaluaciones, devuelve el identificador de la solicitud y evita duplicados. Conserva los registros anteriores y exige sesión, vacante activa, perfil completo y consentimiento. Un nuevo proyecto configurado con `supabase/setup/nuevo-proyecto.sql` ya incluye el cambio.

El despliegue del sitio no ejecuta SQL. Mientras se aplica la migración, la nueva página acepta la respuesta de la función anterior y confirma la postulación sin abrir un examen.

Validación: `npm --prefix tests test` comprueba permisos y postulación con PostgreSQL local. Con el servidor de desarrollo activo, `TALENT_TEST_URL=http://localhost:5173 npm --prefix tests run test:browser` comprueba registro, postulación directa y enlaces antiguos sin crear cuentas ni solicitudes reales.
