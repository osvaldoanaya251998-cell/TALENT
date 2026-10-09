import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { SiteHeader, useSessionRole } from "@/components/site-header";

export function RecruiterShell({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const s = useSessionRole();
  const tabs = [
    { to: "/recruiter/dashboard", l: "Dashboard" },
    { to: "/recruiter/candidates", l: "Candidatos (Kanban)" },
    { to: "/recruiter/new-job", l: "Publicar vacante" },
    { to: "/admin", l: "Rankings y evaluaciones" },
  ] as const;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-4 text-sm md:px-6">
          {tabs.map((t) => (
            <Link key={t.to} to={t.to} className="whitespace-nowrap border-b-2 border-transparent py-3 text-muted-foreground hover:text-foreground"
              activeProps={{ className: "!border-primary !text-foreground font-medium" }}>{t.l}</Link>
          ))}
        </div>
      </div>
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {s === null ? (
          <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : !s.recruiter ? (
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-10 text-center">
            <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
            <h1 className="mt-3 text-lg font-semibold">Acceso solo para reclutadores</h1>
            <p className="mt-1 text-sm text-muted-foreground">Tu cuenta no tiene permisos de reclutador.</p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              {action}
            </div>
            {children}
          </>
        )}
      </main>
    </div>
  );
}
