import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Briefcase,
  Inbox,
  CalendarClock,
  Trophy,
  Pause,
  Play,
  XCircle,
  Pencil,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSessionRole } from "@/components/site-header";
import { RecruiterShell } from "@/components/recruiter-shell";
import { VACANCY_COLUMNS, type Vacancy } from "@/lib/insurance";

export const Route = createFileRoute("/_authenticated/recruiter/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard de reclutador — InsurTalent" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

const STATUS_STYLE: Record<string, string> = {
  activa: "bg-accent text-accent-foreground",
  pausada: "bg-secondary text-secondary-foreground",
  cerrada: "bg-muted text-muted-foreground",
};

function Dashboard() {
  const { user } = Route.useRouteContext();
  const session = useSessionRole();
  const [vacs, setVacs] = useState<Vacancy[]>([]);
  const [apps, setApps] = useState<{ vacancy_id: string | null; status: string }[]>([]);
  const load = useCallback(async () => {
    if (session?.admin === undefined) return;
    let query = supabase
      .from("vacancies")
      .select(VACANCY_COLUMNS)
      .order("created_at", { ascending: false });
    if (!session.admin) query = query.eq("created_by", user.id);
    const [v, a] = await Promise.all([
      query,
      supabase.from("applications").select("vacancy_id,status"),
    ]);
    setVacs((v.data as unknown as Vacancy[]) ?? []);
    setApps(a.data ?? []);
  }, [session?.admin, user.id]);
  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("vacancies")
      .update({ status, is_active: status === "activa" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Vacante ${status}`);
    load();
  };

  const metrics = [
    { i: Briefcase, l: "Vacantes activas", v: vacs.filter((x) => x.is_active).length },
    { i: Inbox, l: "Postulaciones recibidas", v: apps.length },
    {
      i: CalendarClock,
      l: "Entrevistas pendientes",
      v: apps.filter((x) => x.status === "entrevista").length,
    },
    { i: Trophy, l: "Contrataciones", v: apps.filter((x) => x.status === "contratado").length },
  ];

  return (
    <RecruiterShell
      title="Dashboard"
      action={
        <Link to="/recruiter/new-job">
          <Button>
            <Plus className="mr-1.5 h-4 w-4" />
            Publicar nueva vacante
          </Button>
        </Link>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.l} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <m.i className="h-5 w-5 text-primary" />
            <div className="mt-3 text-3xl font-bold">{m.v}</div>
            <div className="text-sm text-muted-foreground">{m.l}</div>
          </div>
        ))}
      </div>
      <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-4">Vacante</th>
              <th className="p-4">Estado</th>
              <th className="p-4">Publicada</th>
              <th className="p-4">Candidatos</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {vacs.map((v) => (
              <tr key={v.id}>
                <td className="p-4">
                  <div className="font-medium">{v.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {v.company} · {v.location}
                  </div>
                </td>
                <td className="p-4">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[v.status] ?? ""}`}
                  >
                    {v.status}
                  </span>
                </td>
                <td className="p-4 text-muted-foreground">
                  {new Date(v.created_at).toLocaleDateString("es-MX")}
                </td>
                <td className="p-4">{apps.filter((a) => a.vacancy_id === v.id).length}</td>
                <td className="p-4">
                  <div className="flex justify-end gap-1">
                    <Link to="/recruiter/candidates" search={{ vacancy: v.id }}>
                      <Button size="sm" variant="ghost" title="Ver candidatos">
                        <Users className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link to="/recruiter/new-job" search={{ edit: v.id }}>
                      <Button size="sm" variant="ghost" title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    {v.status === "activa" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Pausar"
                        onClick={() => setStatus(v.id, "pausada")}
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Activar"
                        onClick={() => setStatus(v.id, "activa")}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    {v.status !== "cerrada" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Cerrar"
                        onClick={() => setStatus(v.id, "cerrada")}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </RecruiterShell>
  );
}
