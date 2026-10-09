import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Search, Loader2, Building2, ArrowRight, SlidersHorizontal } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { JobCard, JobMeta } from "@/components/job-card";
import { RAMOS, PAY_SCHEMES, CEDULAS, MODALITIES, VACANCY_COLUMNS, type Vacancy } from "@/lib/insurance";

const searchSchema = z.object({
  q: z.string().optional(), ramo: z.string().optional(), loc: z.string().optional(), id: z.string().optional(),
});

export const Route = createFileRoute("/jobs")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Buscar empleo en seguros — InsurTalent" },
      { name: "description", content: "Filtra vacantes por ramo (Vida, GMM, Autos, Daños, Fianzas), tipo de contrato, cédula CNSF y modalidad." },
      { property: "og:title", content: "Buscar empleo en seguros — InsurTalent" },
      { property: "og:description", content: "Explora vacantes del sector asegurador y postúlate en un clic." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Jobs,
});

function toggle(list: string[], v: string) { return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]; }

function FilterGroup({ title, options, value, onChange }: { title: string; options: { v: string; l: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="space-y-1.5">
        {options.map((o) => (
          <label key={o.v} className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={value.includes(o.v)} onChange={() => onChange(toggle(value, o.v))} className="h-4 w-4 accent-[var(--primary)]" />
            {o.l}
          </label>
        ))}
      </div>
    </div>
  );
}

function Jobs() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [all, setAll] = useState<Vacancy[] | null>(null);
  const [q, setQ] = useState(search.q ?? "");
  const [loc, setLoc] = useState(search.loc ?? "");
  const [ramos, setRamos] = useState<string[]>(search.ramo ? [search.ramo] : []);
  const [pays, setPays] = useState<string[]>([]);
  const [ceds, setCeds] = useState<string[]>([]);
  const [mods, setMods] = useState<string[]>([]);
  const [selId, setSelId] = useState<string | undefined>(search.id);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    supabase.from("vacancies").select(VACANCY_COLUMNS).eq("is_active", true).order("created_at", { ascending: false })
      .then(({ data }) => setAll((data as unknown as Vacancy[]) ?? []));
  }, []);

  const list = useMemo(() => {
    if (!all) return [];
    const terms = q.toLowerCase().replace("cédula a/b", "").trim();
    return all.filter((v) => {
      const hay = `${v.title} ${v.company} ${v.description} ${v.ramos.join(" ")}`.toLowerCase();
      if (q.toLowerCase() === "remoto") { if (v.modality !== "remoto") return false; }
      else if (q.toLowerCase() === "cédula a/b") { if (!["Cédula A", "Cédula B"].includes(v.cedula)) return false; }
      else if (terms && !terms.split(/\s+/).every((t) => hay.includes(t))) return false;
      if (loc && !(v.location ?? "").toLowerCase().includes(loc.toLowerCase())) return false;
      if (ramos.length && !v.ramos.some((r) => ramos.includes(r))) return false;
      if (pays.length && !pays.includes(v.pay_scheme ?? "")) return false;
      if (ceds.length && !ceds.includes(v.cedula)) return false;
      if (mods.length && !mods.includes(v.modality ?? "")) return false;
      return true;
    });
  }, [all, q, loc, ramos, pays, ceds, mods]);

  const selected = list.find((v) => v.id === selId) ?? list[0];
  const opts = (a: readonly string[]) => a.map((v) => ({ v, l: v }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 md:flex-row md:px-6">
          <label className="flex flex-1 items-center gap-2 rounded-xl border border-border px-3"><Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cargo o palabra clave" className="h-11 w-full bg-transparent text-sm outline-none" /></label>
          <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Ubicación" className="h-11 rounded-xl border border-border bg-transparent px-3 text-sm outline-none md:w-60" />
          <Button variant="outline" className="md:hidden" onClick={() => setShowFilters((s) => !s)}><SlidersHorizontal className="mr-2 h-4 w-4" />Filtros</Button>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:px-6 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1.2fr)]">
        <aside className={`${showFilters ? "block" : "hidden"} space-y-6 lg:block`}>
          <FilterGroup title="Ramo de seguro" options={opts(RAMOS)} value={ramos} onChange={setRamos} />
          <FilterGroup title="Tipo de contrato" options={[{ v: "Mixto", l: "Sueldo base + comisiones" }, { v: "Solo Comisión", l: "Solo comisión" }, { v: "Sueldo Base Fijo", l: "Sueldo base fijo" }].filter((o) => (PAY_SCHEMES as readonly string[]).includes(o.v))} value={pays} onChange={setPays} />
          <FilterGroup title="Cédula CNSF" options={opts(CEDULAS)} value={ceds} onChange={setCeds} />
          <FilterGroup title="Modalidad" options={MODALITIES.map((m) => ({ v: m.v, l: m.l }))} value={mods} onChange={setMods} />
        </aside>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">{all === null ? "Cargando…" : `${list.length} vacantes`}</div>
          {all === null ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /> :
            list.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Sin resultados con estos filtros.</div> :
            list.map((v) => <JobCard key={v.id} v={v} active={selected?.id === v.id} onClick={() => { setSelId(v.id); if (window.innerWidth < 1024) document.getElementById("detalle")?.scrollIntoView({ behavior: "smooth" }); }} />)}
        </div>
        {selected && (
          <article id="detalle" className="h-fit rounded-2xl border border-border bg-card p-7 shadow-soft lg:sticky lg:top-24">
            <div className="flex items-start gap-3">
              <CompanyLogo name={selected.company} src={selected.company_logo_url} size={48} />
              <div>
                <h2 className="text-xl font-bold">{selected.title}</h2>
                <p className="text-sm text-muted-foreground">{selected.company ?? "Confidencial"}</p>
              </div>
            </div>
            <div className="mt-4"><JobMeta v={selected} /></div>
            {selected.salary_text && <div className="mt-3 font-semibold text-primary">{selected.salary_text}</div>}
            <Button size="lg" className="mt-6 w-full" onClick={() => navigate({ to: "/apply", search: { vacancy: selected.slug } })}>
              Postularme en 1 clic <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">Usamos tu perfil y CV guardados. <Link to="/profile" className="underline">Revisar perfil</Link></p>
            <div className="mt-6 space-y-5 text-sm">
              {selected.description && <Block t="Descripción" b={selected.description} />}
              {selected.requirements && <Block t="Requisitos" b={selected.requirements} />}
              {selected.benefits && <Block t="Beneficios" b={selected.benefits} />}
              <Block t="Ramos" b={selected.ramos.join(", ") || "—"} />
            </div>
          </article>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}

function Block({ t, b }: { t: string; b: string }) {
  return <div><div className="mb-1 font-semibold">{t}</div><p className="whitespace-pre-line text-muted-foreground">{b}</p></div>;
}
