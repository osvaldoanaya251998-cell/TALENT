export const SITE_URL = "https://talent.insurtalentmx.workers.dev/";
export const SITE_TITLE = "InsurTalent — Bolsa de trabajo del sector seguros";
export const SITE_DESCRIPTION =
  "InsurTalent es la bolsa de trabajo del sector asegurador en México. Encuentra empleo en aseguradoras, promotorías, brokers e insurtechs o publica vacantes.";
export const SITE_SOCIAL_IMAGE = new URL("og-insurtalent-v1.png", SITE_URL).href;

// Public brand information only; keep candidate and recruiter data out of this graph.
export const SITE_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}#organization`,
      name: "InsurTalent",
      url: SITE_URL,
      logo: new URL("favicon.png", SITE_URL).href,
      description: SITE_DESCRIPTION,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}#website`,
      name: "InsurTalent",
      alternateName: ["InsurTalent MX", "InsurTalent México"],
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      inLanguage: "es-MX",
      publisher: { "@id": `${SITE_URL}#organization` },
    },
  ],
};
