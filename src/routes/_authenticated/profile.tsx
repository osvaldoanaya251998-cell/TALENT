import { useLanguage } from "@/lib/i18n/provider";
import { RAMOS, CERTIFICACIONES } from "@/lib/insurance";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  LogOut,
  Plus,
  Trash2,
  Upload,
  User,
  Video,
  X,
} from "lucide-react";
import momentoLogo from "@/assets/insurtalent-logo.png";
import { PrivacyConsentCheckbox, PRIVACY_POLICY_VERSION } from "@/components/privacy-notice";
import { fetchMyProfile, getCompletion, type Profile } from "@/lib/profile";

const searchSchema = z.object({ next: z.string().optional(), vacancy: z.string().optional() });

export const Route = createFileRoute("/_authenticated/profile")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [{ title: "Mi Perfil — InsurTalent Careers" }, { name: "robots", content: "noindex" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { tr } = useLanguage();
  const navigate = useNavigate();
  const { next, vacancy } = Route.useSearch();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [skillInput, setSkillInput] = useState("");
  const [uploadingCv, setUploadingCv] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        navigate({ to: "/auth" });
        return;
      }
      setUserId(u.user.id);
      const p = await fetchMyProfile();
      setProfile(
        p ??
          ({
            user_id: u.user.id,
            email: u.user.email ?? "",
            nombre: "",
            telefono: "",
            ciudad: "",
            linkedin: "",
            experiencia: 0,
            cv_url: "",
            video_url: "",
            skills: [],
            resumen: "",
            ramos: [],
            certificaciones: [],
            evaluation_id: null,
            candidate_id: null,
            accepted_privacy_policy: false,
            privacy_policy_accepted_at: null,
            privacy_policy_version: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Profile),
      );
      setLoading(false);
    })();
  }, [navigate]);

  const update = (patch: Partial<Profile>) => setProfile((p) => (p ? { ...p, ...patch } : p));

  const save = async () => {
    if (!profile || !userId) return;
    setSaving(true);
    try {
      const payload = {
        user_id: userId,
        nombre: profile.nombre?.trim() || null,
        email: profile.email?.trim() || null,
        telefono: profile.telefono?.trim() || null,
        ciudad: profile.ciudad?.trim() || null,
        linkedin: profile.linkedin?.trim() || null,
        experiencia: Number(profile.experiencia) || 0,
        skills: profile.skills ?? [],
        resumen: profile.resumen?.trim() || null,
        ramos: profile.ramos ?? [],
        certificaciones: profile.certificaciones ?? [],
        cv_url: profile.cv_url,
        video_url: profile.video_url,
        accepted_privacy_policy: profile.accepted_privacy_policy,
        privacy_policy_accepted_at: profile.accepted_privacy_policy
          ? (profile.privacy_policy_accepted_at ?? new Date().toISOString())
          : null,
        privacy_policy_version: profile.accepted_privacy_policy ? PRIVACY_POLICY_VERSION : null,
      };
      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
      toast.success(tr("Perfil guardado"));
      if (next === "/apply" && vacancy) {
        navigate({ to: "/apply", search: { vacancy } });
      } else {
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const uploadFile = async (file: File, kind: "cv" | "video") => {
    if (!userId) return;
    const setBusy = kind === "cv" ? setUploadingCv : setUploadingVideo;
    setBusy(true);
    try {
      if (kind === "cv" && file.type !== "application/pdf") throw new Error("El CV debe ser PDF");
      if (kind === "cv" && file.size > 10 * 1024 * 1024) throw new Error("CV máximo 10 MB");
      if (kind === "video" && file.size > 100 * 1024 * 1024) throw new Error("Video máximo 100 MB");
      const ext = file.name.split(".").pop() || (kind === "cv" ? "pdf" : "mp4");
      const path = `${userId}/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("applications")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const patch = kind === "cv" ? { cv_url: path } : { video_url: path };
      const { error: upErr } = await supabase
        .from("profiles")
        .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
      if (upErr) throw upErr;
      update(patch);
      toast.success(kind === "cv" ? "CV actualizado" : "Video actualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir el archivo");
    } finally {
      setBusy(false);
    }
  };

  const addSkill = () => {
    const v = skillInput.trim();
    if (!v || !profile) return;
    if ((profile.skills ?? []).includes(v)) return;
    update({ skills: [...(profile.skills ?? []), v] });
    setSkillInput("");
  };

  const removeSkill = (s: string) => {
    if (!profile) return;
    update({ skills: (profile.skills ?? []).filter((x) => x !== s) });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const completion = getCompletion(profile);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={momentoLogo} alt="InsurTalent" className="h-6 w-6" />
            <span className="text-sm font-semibold">{tr("InsurTalent Careers")}</span>
          </Link>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> {tr("Cerrar sesión")}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* Header + completion */}
        <div className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary">
                <User className="h-3.5 w-3.5" /> {tr("Mi Perfil")}
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                {profile.nombre?.trim() || tr("Completa tu perfil")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{profile.email}</p>
            </div>
            <div className="min-w-[220px]">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium">{tr("Perfil completado")}</span>
                <span className="tabular-nums text-primary">{completion.percent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${completion.percent}%` }}
                />
              </div>
              {completion.ready ? (
                <div className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-500">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {tr("Listo para postularte")}
                </div>
              ) : (
                <div className="mt-2 text-xs text-muted-foreground">
                  {tr("Falta:")} {completion.missing.map(tr).join(" · ")}
                </div>
              )}
            </div>
          </div>

          {next === "/apply" && vacancy && !completion.ready && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
              {tr("Completa tu perfil para postularte a la vacante seleccionada.")}
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Personal */}
          <Section title={tr("Información personal")}>
            <Field label={tr("Nombre completo")}>
              <Input
                value={profile.nombre ?? ""}
                onChange={(e) => update({ nombre: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={tr("Correo")}>
                <Input
                  type="email"
                  value={profile.email ?? ""}
                  onChange={(e) => update({ email: e.target.value })}
                />
              </Field>
              <Field label={tr("Teléfono")}>
                <Input
                  value={profile.telefono ?? ""}
                  onChange={(e) => update({ telefono: e.target.value })}
                  placeholder="+52 55 1234 5678"
                />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={tr("Ciudad")}>
                <Input
                  value={profile.ciudad ?? ""}
                  onChange={(e) => update({ ciudad: e.target.value })}
                />
              </Field>
              <Field label={tr("LinkedIn")}>
                <Input
                  value={profile.linkedin ?? ""}
                  onChange={(e) => update({ linkedin: e.target.value })}
                  placeholder="https://linkedin.com/in/…"
                />
              </Field>
            </div>
          </Section>

          {/* Experiencia y habilidades */}
          <Section title={tr("Experiencia y habilidades")}>
            <Field label={tr("Años de experiencia")}>
              <Input
                type="number"
                min={0}
                max={60}
                value={profile.experiencia ?? 0}
                onChange={(e) => update({ experiencia: Number(e.target.value) })}
              />
            </Field>
            <div>
              <Label className="mb-2 block text-sm">{tr("Habilidades")}</Label>
              <div className="flex gap-2">
                <Input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  placeholder={tr("Prospección, CRM, Cierre…")}
                />
                <Button type="button" variant="outline" onClick={addSkill}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(profile.skills ?? []).map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-background/40 px-3 py-1 text-xs"
                  >
                    {s}
                    <button
                      onClick={() => removeSkill(s)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {(profile.skills ?? []).length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    {tr("Agrega al menos una habilidad clave.")}
                  </span>
                )}
              </div>
            </div>
          </Section>

          <Section title={tr("Resumen profesional y especialidad en seguros")}>
            <div>
              <Label className="mb-2 block text-sm">{tr("Resumen profesional")}</Label>
              <textarea
                value={profile.resumen ?? ""}
                onChange={(e) => update({ resumen: e.target.value })}
                rows={4}
                placeholder={tr(
                  "Ej. 6 años en venta consultiva de Vida y GMM, cartera de 120 clientes…",
                )}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <ChipGroup
              label={tr("Ramos dominados")}
              options={[...RAMOS]}
              value={profile.ramos ?? []}
              onChange={(v) => update({ ramos: v })}
            />
            <ChipGroup
              label={tr("Certificaciones y cédulas")}
              options={[...CERTIFICACIONES]}
              value={profile.certificaciones ?? []}
              onChange={(v) => update({ certificaciones: v })}
            />
          </Section>

          {/* CV */}
          <Section title={tr("CV")}>
            <FileSlot
              icon={FileText}
              label={tr("CV en PDF")}
              hint="PDF · máximo 10 MB"
              accept="application/pdf"
              currentPath={profile.cv_url ?? null}
              busy={uploadingCv}
              onFile={(f) => uploadFile(f, "cv")}
              onRemove={async () => {
                if (!userId) return;
                await supabase.from("profiles").update({ cv_url: null }).eq("user_id", userId);
                update({ cv_url: null });
              }}
            />
          </Section>

          {/* Video */}
          <Section title={tr("Video de presentación (opcional)")}>
            <FileSlot
              icon={Video}
              label={tr("Video corto")}
              hint="MP4/MOV · máx 2 min · hasta 100 MB"
              accept="video/*"
              currentPath={profile.video_url ?? null}
              busy={uploadingVideo}
              onFile={(f) => uploadFile(f, "video")}
              onRemove={async () => {
                if (!userId) return;
                await supabase.from("profiles").update({ video_url: null }).eq("user_id", userId);
                update({ video_url: null });
              }}
            />
          </Section>
        </div>

        {/* Privacy + save */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <PrivacyConsentCheckbox
            id="privacy-profile"
            checked={profile.accepted_privacy_policy}
            onCheckedChange={(v) =>
              update({
                accepted_privacy_policy: v,
                privacy_policy_accepted_at: v ? new Date().toISOString() : null,
                privacy_policy_version: v ? PRIVACY_POLICY_VERSION : null,
              })
            }
          />
          <div className="mt-6 flex flex-col-reverse items-stretch gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
              {tr("← Volver al inicio")}
            </Link>
            <div className="flex gap-2">
              <Button
                onClick={save}
                disabled={saving}
                className="bg-primary text-primary-foreground hover:opacity-90"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {tr("Guardar perfil")}
              </Button>
              {next === "/apply" && vacancy && completion.ready && (
                <Button
                  onClick={async () => {
                    await save();
                    navigate({ to: "/apply", search: { vacancy } });
                  }}
                  className="bg-primary text-primary-foreground hover:opacity-90"
                >
                  {tr("Continuar a postulación")} <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { tr } = useLanguage();
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {tr(title)}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { tr } = useLanguage();
  return (
    <div>
      <Label className="mb-2 block text-sm">{tr(label)}</Label>
      {children}
    </div>
  );
}

function FileSlot({
  icon: Icon,
  label,
  hint,
  accept,
  currentPath,
  busy,
  onFile,
  onRemove,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  accept: string;
  currentPath: string | null;
  busy: boolean;
  onFile: (f: File) => void;
  onRemove: () => void | Promise<void>;
}) {
  const { tr } = useLanguage();
  const filename = currentPath ? currentPath.split("/").pop() : null;
  return (
    <div>
      <label
        className={`flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-border bg-background/40 p-5 transition-colors hover:border-primary/50 ${busy ? "opacity-60" : ""}`}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          {currentPath ? (
            <>
              <div className="truncate text-sm font-medium">{filename}</div>
              <div className="text-xs text-muted-foreground">
                {tr("Cambiar archivo ·")} {hint}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-medium">{tr(label)}</div>
              <div className="text-xs text-muted-foreground">{hint}</div>
            </>
          )}
        </div>
        <Upload className="h-4 w-4 text-muted-foreground" />
        <input
          type="file"
          accept={accept}
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.currentTarget.value = "";
          }}
        />
      </label>
      {currentPath && (
        <button
          type="button"
          onClick={onRemove}
          className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" /> {tr("Eliminar")}
        </button>
      )}
    </div>
  );
}

function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const { tr } = useLanguage();
  return (
    <div>
      <Label className="mb-2 block text-sm">{tr(label)}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/50"}`}
            >
              {tr(o)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
