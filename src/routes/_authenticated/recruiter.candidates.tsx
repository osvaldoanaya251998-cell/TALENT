import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { FileText, Loader2, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RecruiterShell } from "@/components/recruiter-shell";

export const Route = createFileRoute("/_authenticated/recruiter/candidates")({
  validateSearch: (s) => z.object({ vacancy: z.string().optional() }).parse(s),
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
  id: string; status: Status; vacancy_id: string | null; user_id: string | null;
  vacancy: { title: string } | null; candidate: { nombre: string; email: string } | null;
  profile?: { nombre: string | null; ramos: string[]; certificaciones: string[]; cv_url: string | null } | null;
};

function Kanban() {
  const { vacancy } = Route.useSearch();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      let q = supabase.from("applications").select("id,status,vacancy_id,user_id,vacancy:vacancies(title),candidate:candidates(nombre,email)").order("created_at", { ascending: false });
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
    })();
  }, [vacancy]);

  const move = async (id: string, status: Status) => {
    const prev = cards;
    setCards((c) => c?.map((x) => (x.id === id ? { ...x, status } : x)) ?? null);
    const { error } = await supabase.from("applications").update({ status }).eq("id", id);
    if (error) { setCards(prev); toast.error(error.message); }
  };

  const openCv = async (path: string) => {
    const { data, error } = await supabase.storage.from("applications").createSignedUrl(path, 300);
    if (error || !data) return toast.error("No se pudo abrir el CV");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <RecruiterShell title="Candidatos" action={vacancy ? <Link to="/recruiter/candidates" className="text-sm text-primary">Ver todas las vacantes</Link> : undefined}>
      {cards === null ? <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : (
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
