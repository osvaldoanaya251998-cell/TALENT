# Publicar TALENT en Cloudflare Workers

La aplicación usa renderizado en el servidor. Se publica como un **Worker con
archivos estáticos**, no como una carpeta de Cloudflare Pages. Supabase sigue
guardando las cuentas, las vacantes, los currículums y las notas de entrevistas.
Para conservar esos datos, usa el mismo proyecto de Supabase que está conectado
actualmente a Netlify.

## Conectar el repositorio

1. Abre tu cuenta de Cloudflare y entra en **Workers & Pages**.
2. Selecciona **Create application** y la opción para importar un repositorio de
   GitHub. Autoriza el acceso a `osvaldoanaya251998-cell/TALENT`.
3. Selecciona `TALENT`, la rama `main` y el nombre de Worker `talent`.
4. Configura estos campos:

| Campo | Valor |
| --- | --- |
| Directorio raíz | La raíz del repositorio; déjalo vacío si es opcional |
| Comando de compilación | `npm run build:cloudflare` |
| Comando de despliegue | `npm run deploy:cloudflare` |
| Versión de Node | 22 o superior |

Si puedes seleccionar un comando de instalación, usa `npm ci`. Los archivos de
dependencias también permiten la instalación automática; las descargas de Bun
usan el registro público de npm.

El archivo `wrangler.jsonc` define el nombre y la compatibilidad del Worker.
La compilación genera `.output/server/wrangler.json` con el servidor y la ruta
de los archivos estáticos. El comando de despliegue usa ese archivo generado.
No cambies el destino por `dist` ni copies `NITRO_PRESET=netlify` a Cloudflare.

## Variables de compilación

Antes de publicar, añade estas variables en la configuración de **Builds**.
Copia los valores actuales desde las variables del proyecto de Netlify:

| Variable | Valor |
| --- | --- |
| `NODE_VERSION` | `22` |
| `VITE_SUPABASE_URL` | URL de tu proyecto actual: `https://<id-del-proyecto>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave pública o publishable del mismo proyecto |

La URL no debe terminar en `/rest/v1/`. La clave pública es una clave, no una
URL. Estas dos variables quedan incorporadas en la aplicación durante la
compilación; después de cambiarlas debes iniciar una nueva compilación.

## Variables del servidor

En **Settings → Variables and Secrets** del Worker configura también:

| Variable | Valor |
| --- | --- |
| `SUPABASE_URL` | La misma URL de Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | La misma clave pública |

Estas variables del servidor son distintas de las variables de compilación.
El registro, las vacantes y las notas de entrevistadores usan Supabase; no
requieren una nueva base de datos de Cloudflare.

El resumen automático con IA del panel de administración requiere además los
secretos `SUPABASE_SERVICE_ROLE_KEY` y `LOVABLE_API_KEY`. Añádelos como **Secret**
solo si usas esa función y dispones de esas claves. Nunca les pongas el prefijo
`VITE_`, ni los guardes en GitHub. El resumen de candidato y las notas del panel
de empresa funcionan sin estos secretos.

## Autorizar la nueva dirección en Supabase

Después del despliegue, Cloudflare mostrará la dirección real del Worker, por
ejemplo `https://talent.<tu-subdominio>.workers.dev`.

En el mismo proyecto de Supabase entra en **Authentication → URL Configuration**:

1. Usa esa dirección como **Site URL** cuando vayas a utilizar Cloudflare como
   sitio principal.
2. Añade a **Redirect URLs** la dirección del callback de ese sitio, por ejemplo
   `https://talent.<tu-subdominio>.workers.dev/auth/callback**`. Sustituye el
   subdominio por el real; los asteriscos permiten los parámetros de retorno.
3. Conserva las direcciones de Netlify mientras sigas usando el sitio anterior.

Comprueba el registro de candidato y de empresa, la confirmación por correo y
el inicio de sesión. En el panel de empresa comprueba que al pulsar un candidato
se abre su resumen y que las notas siguen allí después de recargar.

El acceso con Google utiliza actualmente el proveedor de Lovable. Su autorización
para el nuevo dominio debe comprobarse por separado; configurar estas variables
no cambia ese proveedor. El registro y acceso con correo usan Supabase.

## Comprobaciones locales

Con Node 22 o superior y las dos variables públicas de Supabase disponibles:

```sh
npm ci
npm run build:cloudflare
npx --yes wrangler@4.149.0 deploy --dry-run --config .output/server/wrangler.json
npx --yes wrangler@4.149.0 dev --local --config .output/server/wrangler.json
```

`--dry-run` valida el paquete sin publicarlo. Para publicar manualmente desde tu
equipo, primero inicia sesión con `npx --yes wrangler@4.149.0 login` y luego usa
`npm run deploy:cloudflare`.

La configuración de Netlify sigue disponible en `netlify.toml`, de modo que
puedes mantener el sitio anterior mientras verificas el nuevo despliegue.
