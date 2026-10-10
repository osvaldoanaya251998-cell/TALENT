import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { FileText, Loader2, BadgeCheck, Columns3, Table2, Save, NotebookPen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RecruiterShell } from "@/components/recruiter-shell";

export const Route = createFileRoute("/_authenticated/recruiter/candidates")({
  validateSearch: (s) => z.object({ vacancy: z.string().optional(), view: z.enum(["kanban", "table"]).optional() }).parse(s),
  head: () => ({ meta: [{ title: "Candidatos — InsurTalent" }, { name: "robots", content: "noindex" }] }),
  component: Kanban,
});

type Status = "nuevo" | "revisando" | "entrevista" | "aprobado" | "rechazado" | "contratado";
const COLS: { l: string; s: Status[]; drop: Status }[] = [
  { l: "Postulados", s: ["nuevo"], drop: "nuevo" },
  { l: "En revisión", s: ["revisando"], drop: "revisando" },
  { l: "Entrevista", s: ["entrevista"], drop: "entrevista" },
  { l: "Oferta", s: ["aprobado"], drop: "aprobado" },
  { l: "Contratado / Descartado", s: ["contratado", "rechazado"], drop: "contratado" },
];
const ALL: { v: Status; l: string }[] = [
  { v: "nuevo", l: "Postulado" }, { v: "revisando", l: "En revisión" }, { v: "entrevista", l: "Entrevista" },
  { v: "aprobado", l: "Oferta" }, { v: "contratado", l: "Contratado" }, { v: "rechazado", l: "Descartado" },
];

type Card = {
  id: string; status: Status; notas: string | null; vacancy_id: string | null; user_id: string | null;
  vacancy: { title: string } | null; candidate: { nombre: string; email: string } | null;
  profile?: { nombre: string | null; ramos: string[]; certificaciones: string[]; cv_url: string | null } | null;
};

function Kanban() {
  const { vacancy, view = "kanban" } = Route.useSearch();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<Record<string, boolean>>({});
  const setView = (view: "kanban" | "table") => navigate({ to: "/recruiter/candidates", search: { vacancy, view } });
  const [cards, setCards] = useState<Card[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      let q = supabase.from("applications").select("id,status,notas,vacancy_id,user_id,vacancy:vacancies(title),candidate:candidates(nombre,email)").order("created_at", { ascending: false });
      if (vacancy) q = q.eq("vacancy_id", vacancy);
      const { data, error } = await q;
      if (error) { toast.error(error.message); setCards([]); return; }
      const rows = (data as unknown as Card[]) ?? [];
      const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
      if (ids.length) {
        const { data: ps } = await supabase.from("profiles").select("user_id,nombre,ramos,certificaciones,cv_url").in("user_id", ids);
        const map = new Map((ps ?? []).map((p) => [p.user_id, p]));
        rows.forEach((r) => { r.profile = r.user_id ? (map.get(r.user_id) ?? null) : null; });
      }
      setCards(rows);
      setDrafts(Object.fromEntries(rows.map((r) => [r.id, r.notas ?? ""])));
    })();
  }, [vacancy]);

  const move = async (id: string, status: Status) => {
    const previousStatus = cards?.find((c) => c.id === id)?.status;
    setCards((c) => c?.map((x) => (x.id === id ? { ...x, status } : x)) ?? null);
    const { error } = await supabase.from("applications").update({ status }).eq("id", id);
    if (error) {
      if (previousStatus) setCards((c) => c?.map((x) => x.id === id ? { ...x, status: previousStatus } : x) ?? null);
      toast.error(error.message);
    }
  };

  const saveNotes = async (card: Card) => {
    const notes = drafts[card.id] ?? "";
    setSavingNotes((s) => ({ ...s, [card.id]: true }));
    try {
      const { data, error } = await supabase.from("applications")
        .update({ notas: notes || null }).eq("id", card.id).select("id,notas").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("No se pudieron guardar los apuntes. Revisa tus permisos e inténtalo de nuevo.");
      setCards((c) => c?.map((x) => x.id === card.id ? { ...x, notas: data.notas } : x) ?? null);
      toast.success("Apuntes guardados");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron guardar los apuntes");
    } finally {
      setSavingNotes((s) => ({ ...s, [card.id]: false }));
    }
  };

  const openCv = async (path: string) => {
    const { data, error } = await supabase.storage.from("applications").createSignedUrl(path, 300);
    if (error || !data) return toast.error("No se pudo abrir el CV");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <RecruiterShell title="Candidatos" action={vacancy ? <Link to="/recruiter/candidates" className="text-sm text-primary">Ver todas las vacantes</Link> : undefined}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="group" aria-label="Vista de candidatos">
          <Button variant={view === "kanban" ? "default" : "outline"} aria-pressed={view === "kanban"} onClick={() => setView("kanban")}>
            <Columns3 className="mr-2 h-4 w-4" /> Kanban
          </Button>
          <Button variant={view === "table" ? "default" : "outline"} aria-pressed={view === "table"} onClick={() => setView("table")}>
            <Table2 className="mr-2 h-4 w-4" /> Tabla de apuntes
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Guarda tus apuntes por candidato y vacante.</p>
      </div>
      {cards === null ? <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : cards.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">Aún no hay candidatos para estas vacantes.</div>
      ) : view === "table" ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[780px] text-left text-sm">
            <caption className="sr-only">Candidatos y apuntes por postulación</caption>
            <thead className="border-b border-border bg-muted/50 text-muted-foreground">
              <tr>
                {["Candidato", "Vacante", "Estado", "CV", "Apuntes"].map((title) => <th key={title} scope="col" className="px-4 py-3 font-medium">{title}</th>)}
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => {
                const name = c.profile?.nombre || c.candidate?.nombre || "Sin nombre";
                const title = c.vacancy?.title ?? "Vacante";
                const cv = c.profile?.cv_url;
                const changed = (drafts[c.id] ?? "") !== (c.notas ?? "");
                return (
                  <tr key={c.id} className="border-b border-border align-top last:border-0">
                    <td className="px-4 py-4"><div className="font-medium">{name}</div><div className="mt-1 text-xs text-muted-foreground">{c.candidate?.email}</div></td>
                    <td className="px-4 py-4">{title}</td>
                    <td className="px-4 py-4">
                      <select aria-label={`Estado de ${name} para ${title}`} value={c.status} onChange={(e) => move(c.id, e.target.value as Status)} className="rounded-md border border-input bg-background px-2 py-2">
                        {ALL.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-4">{cv ? <Button variant="outline" size="sm" onClick={() => openCv(cv)} aria-label={`Ver CV de ${name}`}><FileText className="mr-1 h-4 w-4" />Ver CV</Button> : <span className="text-muted-foreground">Sin CV</span>}</td>
                    <td className="min-w-[300px] px-4 py-4">
                      <label htmlFor={`notes-${c.id}`} className="sr-only">Apuntes de {name} para {title}</label>
                      <Textarea id={`notes-${c.id}`} value={drafts[c.id] ?? ""} disabled={savingNotes[c.id]} onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))} placeholder="Entrevistas, seguimiento, disponibilidad…" className="min-h-24 resize-y" />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">{changed ? "Cambios sin guardar" : c.notas ? "Guardado" : "Sin apuntes"}</span>
                        <Button size="sm" variant="outline" disabled={!changed || savingNotes[c.id]} onClick={() => saveNotes(c)} aria-label={`Guardar apuntes de ${name} para ${title}`}>
                          {savingNotes[c.id] ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />} Guardar apuntes
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLS.map((col) => {
            const items = cards.filter((c) => col.s.includes(c.status));
            return (
              <div key={col.l} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId) move(dragId, col.drop); setDragId(null); }}
                className="flex w-72 shrink-0 flex-col rounded-2xl border border-border bg-muted/50 p-3">
                <div className="mb-3 flex items-center justify-between px-1 text-sm font-semibold">{col.l}<span className="rounded-full bg-card px-2 text-xs text-muted-foreground">{items.length}</span></div>
                <div className="flex min-h-24 flex-col gap-2">
                  {items.map((c) => {
                    const name = c.profile?.nombre || c.candidate?.nombre || "Sin nombre";
                    const cv = c.profile?.cv_url;
                    return (
                      <div key={c.id} draggable onDragStart={() => setDragId(c.id)}
                        className="cursor-grab rounded-xl border border-border bg-card p-3 shadow-soft active:cursor-grabbing">
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-muted-foreground">{c.vacancy?.title ?? "—"}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(c.profile?.ramos ?? []).map((r) => <span key={r} className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-accent-foreground">{r}</span>)}
                        </div>
                        {(c.profile?.certificaciones ?? []).length > 0 && (
                          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground"><BadgeCheck className="h-3 w-3 text-primary" />{c.profile!.certificaciones.join(", ")}</div>
                        )}
                        {c.notas && <p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-xs text-muted-foreground">{c.notas}</p>}
                        <Button size="sm" variant="ghost" className="mt-2 h-7 px-1 text-xs" onClick={() => setView("table")}><NotebookPen className="mr-1 h-3.5 w-3.5" />Apuntes</Button>
                        <div className="mt-3 flex items-center gap-2">
                          <select value={c.status} onChange={(e) => move(c.id, e.target.value as Status)} className="h-7 flex-1 rounded-md border border-input bg-background px-1 text-xs">
                            {ALL.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                          </select>
                          {cv && <button onClick={() => openCv(cv)} title="Ver CV" className="rounded-md border border-border p-1.5 hover:border-primary"><FileText className="h-3.5 w-3.5" /></button>}
                          <Link to="/admin" className="text-[11px] text-primary">Perfil</Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </RecruiterShell>
  );
}
