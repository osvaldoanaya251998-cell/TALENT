# Registro público de empresas

Las personas se registran con un correo que ya poseen. La aplicación crea una
cuenta de reclutamiento; no crea buzones ni direcciones de correo electrónico.

## Activación en Supabase (una sola vez)

1. Abre el proyecto de Supabase que utiliza este sitio.
2. En SQL Editor, crea una consulta y pega todo el contenido de
   `supabase/migrations/20261009000000_open_company_registration.sql`.
3. Ejecuta la consulta. Está dentro de una transacción y permite repetirla.
4. Si confirmas cuentas por correo, verifica en Authentication → URL Configuration
   que Site URL sea la URL del sitio y que Redirect URLs permita su ruta
   `/auth/callback` con los parámetros de consulta del enlace de confirmación.

Guardar este archivo en GitHub y desplegar en Netlify no ejecuta el SQL en Supabase.
No se necesita introducir la clave de servicio en Netlify ni en el navegador.

## Comportamiento

- `/auth?role=company&mode=signup` abre el registro de empresa.
- `/auth?role=company&mode=login` abre el acceso empresarial.
- Una nueva cuenta con metadatos `role: company` recibe el rol `recruiter`
  mediante un trigger de la base de datos. No recibe permisos de administrador.
- Las cuentas de empresa existentes también se habilitan al ejecutar el SQL.
- Cada reclutador gestiona sus propias vacantes y las postulaciones vinculadas.
- Las vacantes activas siguen siendo públicas. Las vacantes anteriores sin
  propietario permanecen bajo administración; no se asignan a la primera empresa.
- Cambiar los metadatos de una cuenta de candidato no concede permisos.
- El registro de empresa de este cambio es por correo. Google no asigna por sí
  mismo el rol de reclutador a una cuenta nueva.

## Comprobación después de activar

Registra dos empresas con correos diferentes. Publica una vacante desde cada
cuenta, comprueba que ambas aparecen en la bolsa pública y que cada panel muestra
solo las vacantes y postulaciones de su propio propietario. Comprueba además
que un candidato puede registrarse, confirmar su correo y postularse.

## Pruebas locales

`npm ci --prefix tests` instala las herramientas de pruebas independientes.
`npm --prefix tests test` valida permisos en PostgreSQL local mediante PGlite,
sin conectarse al proyecto real de Supabase. Comprueba dos empresas, candidatos,
administradores, archivos de CV y ejecución repetida de la migración.

Con el servidor de desarrollo iniciado, `npm --prefix tests run test:browser`
prueba el registro y la navegación con respuestas simuladas de Supabase. Usa
`TALENT_TEST_URL` si el servidor tiene otra dirección y `CHROMIUM_PATH` si Chromium
está instalado en una ruta distinta de `/usr/bin/chromium`.
