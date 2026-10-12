# Idiomas de InsurTalent

El selector ofrece 245 opciones del catálogo del traductor gratuito, incluidos
idiomas regionales y variantes de escritura. Está en la cabecera de escritorio,
en el menú de móvil y en las páginas de acceso y postulación. La preferencia se
guarda en el navegador y se mantiene al navegar y recargar.

## Funcionamiento y costo

- Español es el texto original de la aplicación.
- Los controles habituales en inglés tienen traducciones incluidas en el código.
- Los demás textos de interfaz se traducen usando el punto de acceso público y
  anónimo de Google Translate. No se usan API keys, Google Cloud Translation,
  Workers AI, tarjetas ni una cuenta de facturación para esta función.
- Las traducciones se guardan en el navegador y se reutilizan. Solo se solicitan
  los textos de interfaz que se muestran y que todavía no están guardados.

Este punto de acceso no es una API contratada: su disponibilidad, límites y
catálogo pueden cambiar. No garantiza cubrir todos los idiomas existentes en el
mundo. Ante un error, la aplicación conserva el texto original y permite seguir
usándola. La función no cambia automáticamente a ningún servicio de pago.

## Datos y presentación

`src/lib/i18n/catalog.ts` contiene únicamente textos de interfaz registrados.
Los nombres, correos, contraseñas, CV, descripciones escritas por empresas y notas
de entrevistas se conservan en su idioma original y no se envían al traductor.
Los valores de base de datos (roles, estados, ramos y modalidades) siguen siendo
los originales, aunque sus etiquetas visibles cambien.

Las solicitudes al traductor omiten credenciales y el encabezado de referencia.
Al usar la traducción automática, el navegador contacta a Google, que puede
recibir información propia de la conexión, como la dirección IP.

El idioma del documento y la dirección de escritura se ajustan a la selección.
Los idiomas de derecha a izquierda, como árabe y hebreo, usan `dir="rtl"`.
Los encabezados y botones se traducen mediante React, sin modificar directamente
el contenido del DOM ni alterar los valores de los formularios.

## Mantener los textos

Para un texto nuevo, registra su versión en español en `UI_MESSAGES` y úsalo con
`tr("Texto en español")` desde `useLanguage()`. Puedes añadir una traducción
revisada a `english.ts`. No registres textos que provengan de usuarios ni pases
datos personales al traductor.

Los códigos de idioma provienen del catálogo de
[googletrans](https://github.com/ssut/py-googletrans). Los nombres nativos están
precalculados para que el HTML del servidor y del navegador coincida.

## Validación

`tests/languages.browser.test.mjs` comprueba persistencia y caché, registro de
empresa, conservación de apuntes privados, valores de vacantes, escritura RTL,
vista móvil y recuperación frente a errores del servicio. El servicio externo y
Supabase se simulan en las pruebas; no se crean cuentas reales ni se envían datos
de candidatos fuera de las pruebas.
