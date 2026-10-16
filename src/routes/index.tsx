import { useLanguage } from "@/lib/i18n/provider";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Search,
  Briefcase,
  Building2,
  MapPinned,
  ArrowRight,
  Loader2,
  UserCheck,
  Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { JobCard } from "@/components/job-card";
import { RAMOS, VACANCY_COLUMNS, type Vacancy } from "@/lib/insurance";
import { SITE_URL, SITE_TITLE, SITE_DESCRIPTION, SITE_STRUCTURED_DATA } from "@/lib/site-metadata";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: SITE_TITLE },
      {
        name: "description",
        content: SITE_DESCRIPTION,
      },
      { property: "og:title", content: SITE_TITLE },
      {
        property: "og:description",
        content: SITE_DESCRIPTION,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: SITE_URL },
      { name: "robots", content: "index,follow,max-image-preview:large" },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(SITE_STRUCTURED_DATA).replace(/</g, "\\u003c"),
      },
    ],
  }),
  component: Landing,
});

const QUICK = [
  "Agente de Seguros",
  "Ajustador",
  "Suscriptor de Riesgos",
  "Gerente Comercial",
  "Cédula A/B",
  "Remoto",
];

function Hero() {
  const { tr } = useLanguage();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [ramo, setRamo] = useState("");
  const [loc, setLoc] = useState("");
  const go = (over?: { q?: string }) =>
    navigate({
      to: "/jobs",
      search: { q: (over?.q ?? q) || undefined, ramo: ramo || undefined, loc: loc || undefined },
    });
  return (
    <section className="bg-hero text-foreground">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-20 md:px-6 md:pt-28">
        <div className="animate-fade-up max-w-3xl">
          <span className="inline-flex rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
            {tr("Bolsa de trabajo 100% sector asegurador")}
          </span>
          <h1 className="mt-5 text-balance text-4xl font-bold tracking-tight md:text-6xl">
            {tr("Tu próxima carrera en")} <span className="text-primary">{tr("seguros")}</span>{" "}
            {tr("empieza aquí.")}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            {tr(
              "InsurTalent conecta talento experto con aseguradoras, promotorías, brokers e insurtechs en México.",
            )}
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            go();
          }}
          className="mt-10 grid gap-2 rounded-2xl bg-card p-2 text-card-foreground shadow-soft md:grid-cols-[1.4fr_1fr_1fr_auto]"
        >
          <label className="flex items-center gap-2 rounded-xl px-3">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tr("Cargo o palabra clave")}
              className="h-12 w-full bg-transparent text-sm outline-none"
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl px-3 md:border-l md:border-border">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <select
              value={ramo}
              onChange={(e) => setRamo(e.target.value)}
              className="h-12 w-full bg-transparent text-sm outline-none"
            >
              <option value="">{tr("Ramo de seguro")}</option>
              {RAMOS.map((r) => (
                <option key={r} value={r}>
                  {tr(r)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl px-3 md:border-l md:border-border">
            <MapPinned className="h-4 w-4 text-muted-foreground" />
            <input
              value={loc}
              onChange={(e) => setLoc(e.target.value)}
              placeholder={tr("Ubicación")}
              className="h-12 w-full bg-transparent text-sm outline-none"
            />
          </label>
          <Button type="submit" size="lg" className="h-12">
            <Search className="mr-2 h-4 w-4" />
            {tr("Buscar")}
          </Button>
        </form>
        <div className="mt-5 flex flex-wrap gap-2">
          {QUICK.map((t) => (
            <button
              key={t}
              onClick={() => go({ q: t })}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {tr(t)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Metrics({ count }: { count: number | null }) {
  const { tr } = useLanguage();
  const items = [
    { k: count === null ? "—" : `${count}`, v: "Vacantes activas hoy" },
    { k: "+80", v: "Promotorías y aseguradoras" },
    { k: "Nacional", v: "Atención en todo México" },
  ];
  return (
    <section className="mx-auto -mt-10 max-w-7xl px-4 md:px-6">
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((m) => (
          <div key={m.v} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="text-3xl font-bold tracking-tight text-foreground">
              {tr(String(m.k))}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{tr(m.v)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Landing() {
  const { tr } = useLanguage();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Vacancy[] | null>(null);
  useEffect(() => {
    supabase
      .from("vacancies")
      .select(VACANCY_COLUMNS)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => setJobs((data as unknown as Vacancy[]) ?? []));
  }, []);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <Hero />
      <Metrics count={jobs?.length ?? null} />

      <section className="mx-auto max-w-7xl px-4 py-24 md:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {tr("Vacantes destacadas")}
            </div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              {tr("Oportunidades del sector")}
            </h2>
          </div>
          <Link
            to="/jobs"
            className="hidden text-sm font-medium text-primary md:inline-flex items-center"
          >
            {tr("Ver todas")} <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
        {jobs === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.slice(0, 6).map((v) => (
              <JobCard
                key={v.id}
                v={v}
                onClick={() => navigate({ to: "/jobs", search: { id: v.id } })}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-24 md:grid-cols-2 md:px-6">
        <div className="rounded-3xl border border-border bg-card p-10 shadow-soft">
          <UserCheck className="h-8 w-8 text-primary" />
          <h3 className="mt-4 text-2xl font-bold">{tr("Para candidatos")}</h3>
          <p className="mt-2 text-muted-foreground">
            {tr(
              "Encuentra vacantes acordes a tu cédula y experiencia. Crea tu perfil una vez y postúlate en un clic.",
            )}
          </p>
          <Link to="/jobs">
            <Button className="mt-6">
              {tr("Buscar empleo")} <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="rounded-3xl border border-border bg-hero p-10 text-foreground shadow-soft">
          <Megaphone className="h-8 w-8 text-primary" />
          <h3 className="mt-4 text-2xl font-bold">{tr("Para empresas")}</h3>
          <p className="mt-2 text-muted-foreground">
            {tr(
              "Publica vacantes y accede al talento del sector seguros y revisa sus perfiles y CV.",
            )}
          </p>
          <Link to="/empresas">
            <Button className="mt-6">
              {tr("Publicar vacante")} <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
