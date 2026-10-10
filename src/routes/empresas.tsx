import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck, KanbanSquare, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter, useSessionRole } from "@/components/site-header";

export const Route = createFileRoute("/empresas")({
  head: () => ({
    meta: [
      { title: "Para empresas — InsurTalent" },
      {
        name: "description",
        content:
          "Publica vacantes del sector seguros, recibe perfiles y CV y gestiona tu pipeline en un tablero Kanban.",
      },
      { property: "og:title", content: "Para empresas — InsurTalent" },
      {
        property: "og:description",
        content: "Recluta agentes, ajustadores y suscriptores certificados con InsurTalent.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Empresas,
});

function Empresas() {
  const session = useSessionRole();
  const items = [
    {
      i: ClipboardCheck,
      t: "Publica en minutos",
      d: "Campos específicos del sector: ramo, cédula CNSF, esquema de compensación.",
    },
    {
      i: Users,
      t: "Perfiles y CV de candidatos",
      d: "Revisa la experiencia, certificaciones y CV de quienes se postulan a tus vacantes.",
    },
    {
      i: KanbanSquare,
      t: "ATS Kanban",
      d: "Mueve candidatos de Postulado a Contratado y consulta su CV y resumen con IA.",
    },
  ];
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="bg-hero text-foreground">
        <div className="mx-auto max-w-5xl px-6 py-24 text-center">
          <h1 className="text-balance text-4xl font-bold tracking-tight md:text-6xl">
            Recluta talento asegurador certificado
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-muted-foreground">
            Aseguradoras, promotorías, brokers e insurtechs encuentran aquí a sus próximos agentes y
            líderes comerciales.
          </p>
          {session?.signedIn ? (
            <Link to="/recruiter/dashboard">
              <Button size="lg" className="mt-8">
                Entrar al panel de empresa <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/auth" search={{ role: "company", mode: "signup" }}>
                <Button size="lg">
                  Registrarme como Empresa <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/auth" search={{ role: "company", mode: "login" }}>
                <Button size="lg" variant="outline">
                  Iniciar sesión como Empresa
                </Button>
              </Link>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Acceso solo para cuentas de reclutador autorizadas.
          </p>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-5 px-6 py-20 md:grid-cols-3">
        {items.map((x) => (
          <div key={x.t} className="rounded-2xl border border-border bg-card p-8 shadow-soft">
            <x.i className="h-7 w-7 text-primary" />
            <h3 className="mt-4 font-semibold">{x.t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{x.d}</p>
          </div>
        ))}
      </section>
      <SiteFooter />
    </div>
  );
}
