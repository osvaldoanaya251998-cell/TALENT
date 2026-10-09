import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Timer, ShieldAlert, ShieldCheck } from "lucide-react";
import momentoLogo from "@/assets/insurtalent-logo.png";
import { PrivacyConsentCheckbox } from "@/components/privacy-notice";

export const Route = createFileRoute("/evaluation")({
  head: () => ({
    meta: [
      { title: "Evaluación técnica — InsurTalent" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Evaluation,
});

type Difficulty = "basic" | "intermediate" | "advanced";
type Question = {
  id: string;
  category: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  difficulty: Difficulty;
  order_index: number;
};

type Letter = "A" | "B" | "C" | "D" | "E";

const DIFFICULTY_SECONDS: Record<Difficulty, number> = {
  basic: 20,
  intermediate: 25,
  advanced: 30,
};
const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  basic: "Básica",
  intermediate: "Intermedia",
  advanced: "Avanzada",
};

function secondsFor(q: Question | undefined): number {
  if (!q) return 25;
  return DIFFICULTY_SECONDS[q.difficulty] ?? 25;
}

function Evaluation() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Letter | null>(null);
  const [timeLeft, setTimeLeft] = useState(25);
  const [locked, setLocked] = useState(false);
  const [submittingFinal, setSubmittingFinal] = useState(false);
  const [evaluationId, setEvaluationId] = useState<string | null>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [started, setStarted] = useState(false);
  const questionStartRef = useRef<number>(Date.now());
  const advancingRef = useRef(false);

  useEffect(() => {
    const evalId = sessionStorage.getItem("momento_evaluation_id");
    const vacancyId = sessionStorage.getItem("momento_vacancy_id");
    if (!evalId || !vacancyId) {
      toast.error("No hay evaluación activa. Aplica primero.");
      navigate({ to: "/", replace: true });
      return;
    }
    setEvaluationId(evalId);
    (async () => {
      const [{ data: qs, error: qerr }, { data: prog }] = await Promise.all([
        supabase.rpc("get_evaluation_questions", { _vacancy_id: vacancyId, _limit: 20 }),
        supabase.rpc("get_evaluation_progress", { _evaluation_id: evalId }),
      ]);
      if (qerr || !qs || (qs as unknown[]).length === 0) {
        toast.error(qerr?.message || "No hay preguntas para esta vacante");
        return;
      }
      const list = qs as Question[];
      setQuestions(list);

      const progRow = Array.isArray(prog) ? (prog as { answered_ids: string[]; status: string }[])[0] : null;
      if (progRow?.status === "completed") {
        navigate({ to: "/evaluation-result", search: { id: evalId }, replace: true });
        return;
      }
      const answered = new Set(progRow?.answered_ids ?? []);
      let resumeIdx = 0;
      for (let i = 0; i < list.length; i++) {
        if (!answered.has(list[i].id)) { resumeIdx = i; break; }
        resumeIdx = i + 1;
      }
      if (resumeIdx >= list.length) resumeIdx = list.length - 1;
      setIndex(resumeIdx);
      setTimeLeft(secondsFor(list[resumeIdx]));
      setLoading(false);
      questionStartRef.current = Date.now();
    })();
  }, [navigate]);

  useEffect(() => {
    if (!evaluationId) return;
    const onVis = () => {
      if (document.hidden) {
        supabase.rpc("increment_tab_switch", { _evaluation_id: evaluationId }).then(({ data }) => {
          const n = typeof data === "number" ? data : 0;
          if (n > 0) toast.warning(`Cambio de pestaña detectado (${n}). Este evento queda registrado.`);
        });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [evaluationId]);

  const q = questions[index];
  const qSeconds = secondsFor(q);

  useEffect(() => {
    setSelected(null);
    setLocked(false);
    setTimeLeft(secondsFor(q));
    questionStartRef.current = Date.now();
    advancingRef.current = false;
  }, [index, q?.id]);

  const finish = useCallback(async (evalId: string) => {
    setSubmittingFinal(true);
    try {
      await supabase.rpc("finalize_evaluation", { _evaluation_id: evalId });
    } catch (e) {
      console.error(e);
    }
    navigate({ to: "/evaluation-result", search: { id: evalId }, replace: true });
  }, [navigate]);

  const advance = useCallback(async (choice: Letter | null) => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setLocked(true);
    const currentQ = q;
    const evalId = evaluationId;
    if (!currentQ || !evalId) return;
    const timeMs = Date.now() - questionStartRef.current;
    try {
      await supabase.rpc("submit_evaluation_answer", {
        _evaluation_id: evalId,
        _question_id: currentQ.id,
        _selected_option: choice ?? "",
        _time_ms: timeMs,
      });
    } catch (e) {
      console.error(e);
    }
    if (index + 1 >= questions.length) {
      await finish(evalId);
      return;
    }
    setIndex((i) => i + 1);
  }, [q, evaluationId, index, questions.length, finish]);

  useEffect(() => {
    if (loading || !q || locked || !started) return;
    if (timeLeft <= 0) {
      advance(selected);
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, loading, q, locked, advance, selected, started]);

  const progress = useMemo(() => (questions.length ? ((index + 1) / questions.length) * 100 : 0), [index, questions.length]);
  const timerPct = qSeconds > 0 ? (timeLeft / qSeconds) * 100 : 0;
  const timerColor = timeLeft <= 5 ? "bg-red-500" : timeLeft <= 10 ? "bg-yellow-500" : "bg-primary";

  if (loading || !q) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Preparando tu evaluación técnica…</p>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border">
          <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
            <div className="flex items-center gap-2">
              <img src={momentoLogo} alt="InsurTalent" className="h-6 w-6" />
              <span className="text-sm font-semibold">InsurTalent</span>
            </div>
            <span className="text-xs text-muted-foreground">Evaluación técnica</span>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-6 py-16">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-soft animate-fade-up">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Antes de comenzar</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Vas a iniciar una evaluación profesional de {questions.length} preguntas con opciones A a E y una sola respuesta correcta.
              El tiempo por pregunta varía según su dificultad: Básica 20s · Intermedia 25s · Avanzada 30s.
              Al agotarse el tiempo se avanza automáticamente y no podrás regresar a preguntas anteriores.
            </p>
            <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              <li>• No se muestran respuestas correctas ni explicaciones.</li>
              <li>• Los cambios de pestaña quedan registrados.</li>
              <li>• Responde con criterio profesional, no con teoría.</li>
            </ul>
            <div className="mt-6">
              <PrivacyConsentCheckbox id="privacy-evaluation" checked={privacyAccepted} onCheckedChange={setPrivacyAccepted} />
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => {
                  if (!privacyAccepted) {
                    toast.error("Debes aceptar el Aviso de Privacidad para iniciar la evaluación.");
                    return;
                  }
                  questionStartRef.current = Date.now();
                  setTimeLeft(secondsFor(q));
                  setStarted(true);
                }}
                className="bg-primary text-primary-foreground hover:opacity-90"
              >
                Iniciar evaluación
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const allOptions: { letter: Letter; text: string }[] = [
    { letter: "A", text: q.option_a },
    { letter: "B", text: q.option_b },
    { letter: "C", text: q.option_c },
    { letter: "D", text: q.option_d },
    { letter: "E", text: q.option_e },
  ];
  const options = allOptions.filter((o) => o.text && o.text.trim().length > 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-6 py-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 font-medium text-muted-foreground">
              <img src={momentoLogo} alt="InsurTalent" className="h-5 w-5" />
              Evaluación técnica
            </div>
            <div className="flex items-center gap-2 tabular-nums">
              <Timer className={`h-4 w-4 ${timeLeft <= 5 ? "text-red-500 animate-pulse" : "text-primary"}`} />
              <span className={`font-semibold ${timeLeft <= 5 ? "text-red-500" : ""}`}>{timeLeft.toString().padStart(2, "0")}s</span>
            </div>
          </div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Pregunta {index + 1} de {questions.length}</span>
            <span className="uppercase tracking-wider">{q.category} · {DIFFICULTY_LABEL[q.difficulty]}</span>
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div className="absolute inset-y-0 left-0 bg-primary/40 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-border/60">
            <div className={`h-full transition-all duration-1000 ${timerColor}`} style={{ width: `${timerPct}%` }} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-soft animate-fade-up">
          <h1 className="text-xl font-semibold leading-relaxed md:text-2xl">{q.question}</h1>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 auto-rows-fr">
            {options.map((o) => {
              const active = selected === o.letter;
              return (
                <button
                  key={o.letter}
                  type="button"
                  disabled={locked}
                  onClick={() => setSelected(o.letter)}
                  className={`group flex h-full w-full min-h-[6rem] items-start gap-4 rounded-xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-70 ${
                    active
                      ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                      : "border-border bg-background/40 hover:border-primary/60 hover:bg-primary/5"
                  }`}
                >
                  <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                    active ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground group-hover:text-primary"
                  }`}>
                    {o.letter}
                  </span>
                  <span className="pt-1.5 text-sm leading-relaxed md:text-base">{o.text}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5" />
              No podrás regresar a esta pregunta.
            </div>
            <Button
              onClick={() => advance(selected)}
              disabled={!selected || locked || submittingFinal}
              className="bg-primary text-primary-foreground hover:opacity-90"
            >
              {submittingFinal ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…</>
              ) : index + 1 >= questions.length ? (
                "Finalizar evaluación"
              ) : (
                "Confirmar y siguiente"
              )}
            </Button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Tiempo por pregunta según dificultad: Básica 20s · Intermedia 25s · Avanzada 30s.
        </p>
      </main>
    </div>
  );
}
