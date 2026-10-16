# Encontrar InsurTalent en Google

La portada identifica la marca como **InsurTalent** en su título, descripción y
contenido visible. Los datos estructurados `WebSite` y `Organization` comunican
el nombre de la plataforma, su dirección y su logo. Se incluye el nombre
alternativo **InsurTalent MX**, coherente con la dirección del sitio.

`public/robots.txt` anuncia el mapa del sitio y excluye del rastreo los paneles
privados y los endpoints MCP. El acceso y la postulación mantienen sus etiquetas
`noindex`; las cuentas, CV y apuntes siguen protegidos por autenticación y RLS.
`robots.txt` no sustituye esos permisos.

`public/sitemap.xml` contiene solo páginas públicas: portada, búsqueda de empleo,
empresas y aviso de privacidad. Cada una tiene una dirección canónica; las
variantes con parámetros de búsqueda o de vista previa apuntan a esa dirección.
No se publican en el sitemap perfiles, candidaturas, currículums ni paneles.
Las vacantes no se presentan como datos estructurados `JobPosting`: esos datos
requieren páginas individuales y condiciones de publicación que este cambio
no incorpora.

## Solicitar la indexación después de publicar

1. Espera a que Cloudflare termine el despliegue de la rama `main`.
2. Abre [Google Search Console](https://search.google.com/search-console/) con
   la cuenta que administra el sitio. Selecciona o añade una propiedad de tipo
   **Prefijo de URL** con la dirección exacta:
   `https://talent.insurtalentmx.workers.dev/`.
3. Si Google solicita verificarla, usa el método que muestre. El archivo existente
   `public/google7c866742e424c9de.html` se conserva; comprueba si coincide con el
   que ofrece Google para esta propiedad. Una propiedad de la dirección antigua
   `osvaldoanaya251998.workers.dev` no equivale a la dirección actual.
4. En **Sitemaps**, envía `sitemap.xml` para esta propiedad. Su dirección completa
   es `https://talent.insurtalentmx.workers.dev/sitemap.xml`.
5. En **Inspección de URLs**, introduce
   `https://talent.insurtalentmx.workers.dev/`, pulsa **Probar URL publicada** y,
   si la prueba permite indexarla, **Solicitar indexación**.
6. Revisa en **Indexación → Páginas** si Google ha descubierto e indexado la
   portada. La inspección del URL da el estado de indexación; una búsqueda con
   `site:` no sustituye ese informe. Más adelante, **Rendimiento** permite ver
   impresiones y clics para búsquedas como `InsurTalent` e `InsurTalent MX`.

Search Console y estos cambios son gratuitos. No se han contratado anuncios ni
servicios de posicionamiento. Google decide cuándo rastrear e indexar y cómo
ordenar los resultados; no se garantiza una fecha ni la primera posición.

Si se cambia el dominio, actualiza `src/lib/site-metadata.ts`, `robots.txt` y
`sitemap.xml`, verifica la nueva propiedad y conserva las redirecciones de la
dirección anterior cuando sea posible. No cambies la dirección repetidamente
mientras Google la descubre. Los datos estructurados se pueden comprobar con
el [validador de Schema.org](https://validator.schema.org/); no garantizan un
resultado enriquecido en Google.
