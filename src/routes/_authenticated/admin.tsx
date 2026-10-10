import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { LogOut, Search, FileText, Video, Loader2, Users, Inbox, UserCheck, Award, ExternalLink, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import momentoLogo from "@/assets/insurtalent-logo.png";
import { useServerFn } from "@tanstack/react-start";
import { summarizeCandidate } from "@/lib/summarize-candidate.functions";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Dashboard — InsurTalent" }, { name: "robots", content: "noindex" }] }),
  component: Admin,
});

type Status = "nuevo" | "revisando" | "entrevista" | "aprobado" | "rechazado" | "contratado";
const STATUS: { v: Status; l: string; color: string }[] = [
  { v: "nuevo", l: "Nuevo", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  { v: "revisando", l: "Revisando", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  { v: "entrevista", l: "Entrevista", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  { v: "aprobado", l: "Aprobado", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  { v: "rechazado", l: "Rechazado", color: "bg-red-500/15 text-red-400 border-red-500/30" },
  { v: "contratado", l: "Contratado", color: "bg-primary/20 text-primary border-primary/40" },
];

type Vacancy = { id: string; title: string };

type Row = {
  id: string;
  status: Status;
  respuestas: Record<string, unknown>;
  created_at: string;
  vacancy_id: string | null;
  vacancy: { id: string; title: string } | null;
  candidate: {
    id: string; nombre: string; email: string; telefono: string; ciudad: string; linkedin: string | null; experiencia: number;
    uploads: { cv_url: string | null; video_url: string | null }[];
  } | null;

};

function getCandidateInfo(row: Row) {
  const respuestas = row.respuestas ?? {};
  return {
    nombre: row.candidate?.nombre ?? String(respuestas.nombre ?? "Candidato sin perfil"),
    email: row.candidate?.email ?? String(respuestas.email ?? "Sin correo"),
    telefono: row.candidate?.telefono ?? String(respuestas.telefono ?? "—"),
    ciudad: row.candidate?.ciudad ?? String(respuestas.ciudad ?? "—"),
    linkedin: row.candidate?.linkedin ?? null,
    experiencia: row.candidate?.experiencia ?? 0,
    uploads: row.candidate?.uploads ?? [],
  };
}

type SortMode = "date_desc" | "date_asc";
type DateRange = "all" | "7d" | "30d" | "90d";

function Admin() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [selected, setSelected] = useState<Row | null>(null);
  const [urls, setUrls] = useState<{ cv?: string; video?: string }>({});
  const [userEmail, setUserEmail] = useState("");
  const [aiSummary, setAiSummary] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const runSummarize = useServerFn(summarizeCandidate);

  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [vacancyFilter, setVacancyFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<SortMode>("date_desc");
  const [dateRange, setDateRange] = useState<DateRange>("all");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setUserEmail(u.user?.email ?? "");
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", u.user!.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!roleData);
      if (!roleData) return;
      const { data: vac } = await supabase.from("vacancies").select("id,title").order("title");
      setVacancies((vac as any) ?? []);
      await load();
    })();
  }, []);

  const load = async () => {
    const { data, error } = await supabase
      .from("applications")
      .select("id,status,respuestas,created_at,vacancy_id,vacancy:vacancies(id,title),candidate:candidates(id,nombre,email,telefono,ciudad,linkedin,experiencia,uploads(cv_url,video_url))")
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setRows((data as unknown as Row[]) ?? []);
  };

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    const cutoff = dateRange === "all" ? 0 : Date.now() - ({ "7d": 7, "30d": 30, "90d": 90 }[dateRange] * 86400000);
    return rows
      .filter((r) => {
        if (filter !== "all" && r.status !== filter) return false;
        if (vacancyFilter !== "all" && r.vacancy_id !== vacancyFilter) return false;
        if (cutoff && new Date(r.created_at).getTime() < cutoff) return false;
        if (!q) return true;
        const candidate = getCandidateInfo(r);
        return (
          candidate.nombre.toLowerCase().includes(q) ||
          candidate.email.toLowerCase().includes(q) ||
          candidate.ciudad.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortMode === "date_desc") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sortMode === "date_asc") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return 0;
      });
  }, [rows, search, filter, vacancyFilter, sortMode, dateRange]);

  const stats = useMemo(() => {
    const s = { total: rows?.length ?? 0, nuevo: 0, entrevista: 0, contratado: 0 };
    rows?.forEach((r) => { if (r.status === "nuevo") s.nuevo++; if (r.status === "entrevista") s.entrevista++; if (r.status === "contratado") s.contratado++; });
    return s;
  }, [rows]);

  const setStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("applications").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows((r) => r?.map((x) => x.id === id ? { ...x, status } : x) ?? null);
    setSelected((s) => s && s.id === id ? { ...s, status } : s);
    toast.success("Estatus actualizado");
  };

  const openDetail = async (r: Row) => {
    setSelected(r);
    setUrls({});
    setAiSummary("");
    const up = getCandidateInfo(r).uploads?.[0];
    const links: { cv?: string; video?: string } = {};
    if (up?.cv_url) {
      const { data } = await supabase.storage.from("applications").createSignedUrl(up.cv_url, 3600);
      if (data) links.cv = data.signedUrl;
    }
    if (up?.video_url) {
      const { data } = await supabase.storage.from("applications").createSignedUrl(up.video_url, 3600);
      if (data) links.video = data.signedUrl;
    }
    setUrls(links);
  };

  const generateSummary = async () => {
    if (!selected) return;
    setAiLoading(true);
    setAiSummary("");
    try {
      const res = await runSummarize({ data: { application_id: selected.id } });
      setAiSummary(res.summary);
      if (!res.hasCv) toast.info("Se generó el resumen sin CV adjunto.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo generar el resumen");
    } finally {
      setAiLoading(false);
    }
  };

  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); };

  if (isAdmin === null) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold">Sin permisos</h1>
          <p className="mt-2 text-sm text-muted-foreground">Tu cuenta ({userEmail}) aún no tiene rol de administrador. Un admin debe ejecutar en la base de datos:</p>
          <code className="mt-4 block break-all rounded-md bg-background p-3 text-left text-xs">INSERT INTO public.user_roles (user_id, role) VALUES ('&lt;tu-user-id&gt;', 'admin');</code>
          <Button variant="outline" className="mt-6" onClick={signOut}>Cerrar sesión</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <img src={momentoLogo} alt="InsurTalent" className="h-6 w-6" />
            <span className="text-sm font-semibold">InsurTalent</span>
            <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Reclutamiento</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <ThemeToggle />
            <span className="hidden md:inline">{userEmail}</span>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="mr-1.5 h-3.5 w-3.5" /> Salir</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Candidatos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gestiona el pipeline de reclutamiento.</p>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-4">
          {[
            { icon: Users, l: "Total", v: stats.total },
            { icon: Inbox, l: "Nuevos", v: stats.nuevo },
            { icon: UserCheck, l: "Entrevista", v: stats.entrevista },
            { icon: Award, l: "Contratados", v: stats.contratado },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.l}</div>
                <s.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-2 text-3xl font-semibold">{s.v}</div>
            </div>
          ))}
        </div>

        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nombre, email o ciudad…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={vacancyFilter} onValueChange={setVacancyFilter}>
            <SelectTrigger className="w-full md:w-56"><SelectValue placeholder="Vacante" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las vacantes</SelectItem>
              {vacancies.map((v) => <SelectItem key={v.id} value={v.id}>{v.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Estatus" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estatus</SelectItem>
              {STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Fecha" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el tiempo</SelectItem>
              <SelectItem value="7d">Últimos 7 días</SelectItem>
              <SelectItem value="30d">Últimos 30 días</SelectItem>
              <SelectItem value="90d">Últimos 90 días</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
            <SelectTrigger className="w-full md:w-52"><SelectValue placeholder="Ordenar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Más recientes</SelectItem>
              <SelectItem value="date_asc">Más antiguos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid grid-cols-[0.3fr_1.5fr_1.1fr_0.6fr_0.7fr] gap-4 border-b border-border bg-background/40 px-5 py-3 text-xs uppercase tracking-wider text-muted-foreground">
            <div>#</div><div>Candidato</div><div>Vacante</div><div>Exp.</div><div>Estatus</div>
          </div>
          {rows === null ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No hay candidatos.</div>
          ) : filtered.map((r, i) => {
            const st = STATUS.find((s) => s.v === r.status)!;
            const candidate = getCandidateInfo(r);
            const date = new Date(r.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
            return (
              <button key={r.id} onClick={() => openDetail(r)} className="grid w-full grid-cols-[0.3fr_1.5fr_1.1fr_0.6fr_0.7fr] gap-4 border-b border-border px-5 py-4 text-left text-sm transition-colors hover:bg-accent/50 last:border-0">
                <div className="font-semibold tabular-nums text-muted-foreground">#{i + 1}</div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{candidate.nombre}</div>
                  <div className="truncate text-xs text-muted-foreground">{candidate.email} · {candidate.ciudad}</div>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs">{r.vacancy?.title ?? "—"}</div>
                  <div className="text-[10px] text-muted-foreground">{date}</div>
                </div>
                <div className="text-muted-foreground">{candidate.experiencia}a</div>
                <div><Badge variant="outline" className={st.color}>{st.l}</Badge></div>
              </button>
            );
          })}
        </div>
      </main>


      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              {(() => {
                const candidate = getCandidateInfo(selected);
                return (
                  <>
              <DialogHeader>
                <DialogTitle className="text-xl">{candidate.nombre}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                  <Info label="Email" value={candidate.email} />
                  <Info label="Teléfono" value={candidate.telefono} />
                  <Info label="Ciudad" value={candidate.ciudad} />
                  <Info label="Experiencia" value={`${candidate.experiencia} años`} />
                  <Info label="LinkedIn" value={candidate.linkedin || "—"} link={candidate.linkedin || undefined} />
                  <Info label="Aplicó" value={new Date(selected.created_at).toLocaleString("es-MX")} />
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 shadow-sm">
                  <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
                  <div className="relative mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">Resumen IA del perfil</div>
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">CV y experiencia profesional</div>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={generateSummary} disabled={aiLoading} className="border-primary/40">
                      {aiLoading ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Analizando…</> : <><Sparkles className="mr-1.5 h-3.5 w-3.5" /> {aiSummary ? "Regenerar" : "Generar resumen"}</>}
                    </Button>
                  </div>
                  {aiSummary ? (
                    <div className="relative rounded-xl border border-border/60 bg-background/60 p-5 backdrop-blur-sm">
                      <div className="prose prose-sm dark:prose-invert max-w-none
                        prose-headings:mt-0 prose-headings:mb-2 prose-headings:font-semibold
                        prose-h2:text-[13px] prose-h2:uppercase prose-h2:tracking-wider prose-h2:text-primary
                        prose-h2:flex prose-h2:items-center prose-h2:gap-2
                        prose-h2:pb-1.5 prose-h2:border-b prose-h2:border-primary/20
                        prose-p:my-2 prose-p:leading-relaxed prose-p:text-foreground/90
                        prose-ul:my-2 prose-ul:pl-5 prose-li:my-1 prose-li:marker:text-primary
                        prose-strong:text-foreground prose-strong:font-semibold">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiSummary}</ReactMarkdown>
                      </div>
                    </div>
                  ) : aiLoading ? (
                    <div className="relative space-y-2 rounded-xl border border-border/60 bg-background/40 p-5">
                      <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-full animate-pulse rounded bg-muted" />
                      <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                    </div>
                  ) : (
                    <p className="relative text-xs text-muted-foreground">
                      Genera un análisis con IA a partir del CV y de la experiencia profesional para identificar rápidamente el perfil, fortalezas y encaje del candidato.
                    </p>
                  )}
                </div>


                <div>
                  <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Estatus</div>
                  <Select value={selected.status} onValueChange={(v) => setStatus(selected.id, v as Status)}>
                    <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Respuestas</div>
                  <div className="space-y-3">
                    {Object.entries(selected.respuestas || {}).map(([k, v]) => (
                      <div key={k} className="rounded-lg border border-border bg-background/40 p-4">
                        <div className="mb-1 text-xs font-medium text-primary">{labelFor(k)}</div>
                        <div className="whitespace-pre-wrap text-sm">{String(v)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {urls.cv ? (
                    <a href={urls.cv} target="_blank" rel="noreferrer">
                      <Button variant="outline"><FileText className="mr-1.5 h-4 w-4" /> Abrir CV <ExternalLink className="ml-1.5 h-3 w-3"/></Button>
                    </a>
                  ) : <Button variant="outline" disabled><FileText className="mr-1.5 h-4 w-4" /> Sin CV</Button>}
                  {urls.video ? (
                    <a href={urls.video} target="_blank" rel="noreferrer">
                      <Button variant="outline"><Video className="mr-1.5 h-4 w-4" /> Ver video <ExternalLink className="ml-1.5 h-3 w-3"/></Button>
                    </a>
                  ) : candidate.uploads?.[0]?.video_url ? <Button variant="outline" disabled><Loader2 className="mr-1.5 h-4 w-4 animate-spin"/>Cargando video…</Button> : <Button variant="outline" disabled><Video className="mr-1.5 h-4 w-4"/>Sin video</Button>}
                </div>
              </div>
                  </>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      {link ? <a href={link} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">{value}</a> : <div className="text-sm">{value}</div>}
    </div>
  );
}

function labelFor(k: string): string {
  const map: Record<string, string> = {
    motivacion: "¿Por qué InsurTalent?",
    experienciaComercial: "Experiencia comercial / ventas",
    motivacionProfesional: "Motivación profesional",
    ingresoEsperado: "Ingreso mensual esperado",
    comodoConMetas: "¿Cómodo con metas/KPIs?",
  };
  return map[k] || k;
}
