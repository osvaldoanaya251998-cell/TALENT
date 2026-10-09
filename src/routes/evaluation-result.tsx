import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Mail, Sparkles, Trophy, AlertCircle, XCircle, Award } from "lucide-react";
import { z } from "zod";
import momentoLogo from "@/assets/insurtalent-logo.svg";

const searchSchema = z.object({ id: z.string().uuid().optional() });

export const Route = createFileRoute("/evaluation-result")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Evaluación enviada — InsurTalent" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EvaluationResult,
});

type EvalRow = {
  id: string;
  percentage: number | string;
  compatibility: string | null;
  status: string;
};

type StatusInfo = {
  label: string;
  description: string;
  icon: typeof Trophy;
  chipClass: string;
  ringClass: string;
};

function statusFor(comp: string | null, pct: number): StatusInfo {
  const c = (comp || "").toLowerCase();
  if (c === "excelente" || pct >= 85) {
    return {
      label: "Excelente perfil",
      description: "Tu evaluación muestra un dominio destacado del rol. Tienes muy alta compatibilidad con la vacante.",
      icon: Trophy,
      chipClass: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
      ringClass: "ring-emerald-500/30",
    };
  }
  if (c === "recomendado" || pct >= 70) {
    return {
      label: "Perfil recomendado",
      description: "Tu evaluación es sólida y encaja bien con lo que buscamos para esta posición.",
      icon: Award,
      chipClass: "bg-primary/15 text-primary border-primary/30",
      ringClass: "ring-primary/30",
    };
  }
  if (c === "revision" || pct >= 50) {
    return {
      label: "Perfil en revisión",
      description: "Tu evaluación queda en revisión por el equipo de reclutamiento.",
      icon: AlertCircle,
      chipClass: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
      ringClass: "ring-yellow-500/30",
    };
  }
  return {
    label: "Perfil no compatible",
    description: "En esta ocasión tu evaluación no alcanza el nivel requerido para esta vacante. Te invitamos a explorar otras oportunidades.",
    icon: XCircle,
    chipClass: "bg-red-500/15 text-red-500 border-red-500/30",
    ringClass: "ring-red-500/30",
  };
}

function EvaluationResult() {
  const { id } = Route.useSearch();
  const storedId = typeof window !== "undefined" ? sessionStorage.getItem("momento_evaluation_id") : null;
  const evaluationId = id || storedId || "";
  const candidateName = typeof window !== "undefined" ? sessionStorage.getItem("momento_candidate_name") : null;
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<EvalRow | null>(null);

  useEffect(() => {
    if (!evaluationId) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("evaluations")
        .select("id,percentage,compatibility,status")
        .eq("id", evaluationId)
        .maybeSingle();
      setRow((data as EvalRow | null) ?? null);
      setLoading(false);
    })();
  }, [evaluationId]);

  if (!evaluationId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold">Sin evaluación</h1>
          <p className="mt-2 text-sm text-muted-foreground">Completa el proceso de aplicación primero.</p>
          <Link to="/apply"><Button className="mt-6 bg-primary text-primary-foreground hover:opacity-90">Ir a aplicar</Button></Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!row) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold">Evaluación no encontrada</h1>
          <Link to="/"><Button variant="outline" className="mt-6 border-border">Volver al inicio</Button></Link>
        </div>
      </div>
    );
  }

  const pct = Number(row.percentage) || 0;
  const info = statusFor(row.compatibility, pct);
  const StatusIcon = info.icon;
  const firstName = candidateName ? candidateName.split(" ")[0] : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={momentoLogo} alt="InsurTalent" className="h-6 w-6" />
            <span className="text-sm font-semibold">InsurTalent</span>
          </Link>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">Volver al inicio</Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-16">
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft animate-fade-up">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {firstName ? `¡Gracias, ${firstName}!` : "¡Evaluación completada!"}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Recibimos tus respuestas. Tu postulación está en revisión.
          </p>

          <div className={`mx-auto mt-8 flex flex-col items-center rounded-2xl border border-border bg-background/40 p-6 ring-1 ${info.ringClass}`}>
            <StatusIcon className={`mb-2 h-8 w-8 ${info.chipClass.split(" ").find((c) => c.startsWith("text-"))}`} />
            <div className="text-5xl font-bold tracking-tight tabular-nums">{Math.round(pct)}%</div>
            <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">Porcentaje de aciertos</div>
            <div className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${info.chipClass}`}>
              <span>Compatibilidad · {info.label}</span>
            </div>
            <p className="mt-4 max-w-md text-sm text-muted-foreground">{info.description}</p>
          </div>

          <div className="mt-8 grid gap-4 text-left sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-background/40 p-5">
              <div className="mb-2 flex items-center gap-2 text-primary">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Siguiente paso</span>
              </div>
              <p className="text-sm text-muted-foreground">Nuestro equipo revisará tu perfil y evaluación en detalle.</p>
            </div>
            <div className="rounded-xl border border-border bg-background/40 p-5">
              <div className="mb-2 flex items-center gap-2 text-primary">
                <Mail className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Contacto</span>
              </div>
              <p className="text-sm text-muted-foreground">Te escribiremos por correo si tu perfil avanza a la siguiente etapa.</p>
            </div>
          </div>

          <p className="mt-8 text-xs text-muted-foreground">
            Por políticas del proceso, las respuestas correctas y explicaciones son confidenciales.
          </p>

          <Link to="/"><Button variant="outline" className="mt-8 border-border">Volver al inicio</Button></Link>
        </div>
      </main>
    </div>
  );
}
