import { LanguageSelector } from "@/components/language-selector";
import { useLanguage } from "@/lib/i18n/provider";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowRight, Briefcase, CheckCircle2, Loader2, MapPin, User } from "lucide-react";
import momentoLogo from "@/assets/insurtalent-logo.png";
import { fetchMyProfile, getCompletion, type Profile } from "@/lib/profile";

const searchSchema = z.object({ vacancy: z.string().optional() });

export const Route = createFileRoute("/apply")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Postúlate — InsurTalent Careers" },
      { name: "description", content: "Postúlate a una vacante InsurTalent con tu perfil único." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Apply,
});

type VacancyRow = { id: string; title: string; slug: string; description: string | null };

function Apply() {
  const { tr } = useLanguage();
  const navigate = useNavigate();
  const { vacancy: vacancySlug } = Route.useSearch();
  const [checking, setChecking] = useState(true);
  const [vacancy, setVacancy] = useState<VacancyRow | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      // Ensure vacancy
      let vq = supabase.from("vacancies").select("id,title,slug,description").eq("is_active", true);
      if (vacancySlug) vq = vq.eq("slug", vacancySlug);
      const { data: vacRow } = await vq.limit(1).maybeSingle();
      if (!vacRow) {
        toast.error(tr("Vacante no encontrada. Elige una posición disponible."));
        navigate({ to: "/", hash: "vacantes", replace: true });
        return;
      }
      setVacancy(vacRow as VacancyRow);

      // Ensure auth
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate({
          to: "/auth",
          search: { next: "/apply", vacancy: (vacRow as VacancyRow).slug },
          replace: true,
        });
        return;
      }

      // Load profile
      const p = await fetchMyProfile();
      setProfile(p);
      setChecking(false);
    })();
  }, [vacancySlug, navigate]);

  const completion = profile ? getCompletion(profile) : null;

  const goApply = async () => {
    if (!vacancy) return;
    if (!completion?.ready) {
      toast.error(tr("Completa tu perfil antes de postularte."));
      navigate({ to: "/profile", search: { next: "/apply", vacancy: vacancy.slug } });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("apply_to_vacancy", { _vacancy_id: vacancy.id });
      if (error) throw error;
      const result = data as { application_id?: string } | null;
      if (!result?.application_id) throw new Error("No se pudo crear la postulación");
      setSubmitted(true);
      toast.success(tr("Postulación enviada. La empresa ya puede revisar tu perfil y CV."));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo aplicar";
      if (msg.includes("profile_incomplete")) {
        toast.error(tr("Completa tu perfil antes de postularte."));
        navigate({ to: "/profile", search: { next: "/apply", vacancy: vacancy.slug } });
      } else if (msg.includes("not_authenticated")) {
        navigate({ to: "/auth", search: { next: "/apply", vacancy: vacancy.slug } });
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (checking || !vacancy || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={momentoLogo} alt="InsurTalent" className="h-6 w-6" />
            <span className="text-sm font-semibold">{tr("InsurTalent Careers")}</span>
          </Link>
          <LanguageSelector />
          <Link
            to="/profile"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <User className="h-3.5 w-3.5" /> {tr("Mi perfil")}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary">
            <Briefcase className="h-3.5 w-3.5" /> {tr("Vacante seleccionada")}
          </div>
          <div className="mt-1.5 text-lg font-semibold">{vacancy.title}</div>
          {vacancy.description && (
            <div className="mt-1 text-sm text-muted-foreground">{vacancy.description}</div>
          )}
          <Link
            to="/"
            hash="vacantes"
            className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <MapPin className="h-3 w-3" /> {tr("Cambiar vacante")}
          </Link>
        </div>

        {submitted ? (
          <div
            className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft"
            role="status"
          >
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-4 text-2xl font-semibold">{tr("Postulación enviada")}</h1>
            <p className="mt-2 text-muted-foreground">
              {tr("La empresa ya puede revisar tu perfil y CV para esta vacante.")}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/jobs">
                <Button>{tr("Buscar más empleos")}</Button>
              </Link>
              <Link to="/profile">
                <Button variant="outline">{tr("Ver mi perfil")}</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 shadow-soft animate-fade-up">
            <h1 className="text-2xl font-semibold tracking-tight">{tr("Postulación rápida")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {tr("Tu perfil se envía a esta vacante sin volver a llenar formularios.")}
            </p>

            <div className="mt-6 rounded-xl border border-border bg-background/40 p-5">
              <div className="mb-3 flex items-center justify-between text-xs">
                <span className="font-medium">{tr("Perfil completado")}</span>
                <span className="tabular-nums text-primary">{completion?.percent ?? 0}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${completion?.percent ?? 0}%` }}
                />
              </div>
              <div className="mt-4 grid gap-2 text-sm">
                <SummaryRow label={tr("Nombre")} value={profile.nombre} />
                <SummaryRow label={tr("Correo")} value={profile.email} />
                <SummaryRow label={tr("Teléfono")} value={profile.telefono} />
                <SummaryRow label={tr("Ciudad")} value={profile.ciudad} />
                <SummaryRow label={tr("CV")} value={profile.cv_url ? tr("Cargado") : ""} />
              </div>
              {!completion?.ready && (
                <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                  {tr("Completa tu perfil antes de postularte. Falta:")}{" "}
                  {completion?.missing.map(tr).join(" · ")}
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
              <Link to="/profile" className="text-sm text-muted-foreground hover:text-foreground">
                {tr("Editar mi perfil")}
              </Link>
              <Button
                onClick={goApply}
                disabled={submitting || !completion?.ready}
                className="bg-primary text-primary-foreground hover:opacity-90"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {tr("Enviando…")}
                  </>
                ) : (
                  <>
                    {tr("Postularme")} <ArrowRight className="ml-1.5 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  const { tr } = useLanguage();
  const ok = !!(value && value.trim());
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{tr(label)}</span>
      <span className={ok ? "inline-flex items-center gap-1 text-foreground" : "text-amber-500"}>
        {ok ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> {value}
          </>
        ) : (
          tr("Falta")
        )}
      </span>
    </div>
  );
}
