import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { RecruiterShell } from "@/components/recruiter-shell";
import {
  RAMOS,
  PAY_SCHEMES,
  CEDULAS,
  MODALITIES,
  VACANCY_COLUMNS,
  type Vacancy,
} from "@/lib/insurance";
import { LogoUploader } from "@/components/company-logo";

export const Route = createFileRoute("/_authenticated/recruiter/new-job")({
  validateSearch: (s) => z.object({ edit: z.string().optional() }).parse(s),
  head: () => ({
    meta: [{ title: "Publicar vacante — InsurTalent" }, { name: "robots", content: "noindex" }],
  }),
  component: NewJob,
});

const empty = {
  title: "",
  company: "",
  ramos: [] as string[],
  pay_scheme: "Mixto",
  salary_text: "",
  cedula: "No requiere",
  location: "",
  modality: "hibrido",
  description: "",
  requirements: "",
  benefits: "",
  company_logo_url: null as string | null,
};

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

const area = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const select = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

function NewJob() {
  const { user } = Route.useRouteContext();
  const { edit } = Route.useSearch();
  const navigate = useNavigate();
  const [f, setF] = useState(empty);
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<typeof empty>) => setF((x) => ({ ...x, ...p }));

  useEffect(() => {
    if (!edit) return;
    supabase
      .from("vacancies")
      .select(VACANCY_COLUMNS)
      .eq("id", edit)
      .maybeSingle()
      .then(({ data }) => {
        const v = data as unknown as Vacancy | null;
        if (v)
          setF({
            title: v.title,
            company: v.company ?? "",
            ramos: v.ramos,
            pay_scheme: v.pay_scheme ?? "Mixto",
            salary_text: v.salary_text ?? "",
            cedula: v.cedula,
            location: v.location ?? "",
            modality: v.modality ?? "hibrido",
            description: v.description ?? "",
            requirements: v.requirements ?? "",
            benefits: v.benefits ?? "",
            company_logo_url: v.company_logo_url ?? null,
          });
      });
  }, [edit]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.title.trim() || !f.company.trim() || f.ramos.length === 0 || !f.location.trim()) {
      return toast.error("Completa título, empresa, al menos un ramo y ubicación.");
    }
    setSaving(true);
    const payload = {
      ...f,
      modality: f.modality as "remoto" | "hibrido" | "presencial",
      title: f.title.trim(),
      company: f.company.trim(),
    };
    const res = edit
      ? await supabase.from("vacancies").update(payload).eq("id", edit)
      : await supabase.from("vacancies").insert({
          ...payload,
          created_by: user.id,
          slug: slugify(f.title),
          is_active: true,
          status: "activa",
        });
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(edit ? "Vacante actualizada" : "Vacante publicada");
    navigate({ to: "/recruiter/dashboard" });
  };

  return (
    <RecruiterShell title={edit ? "Editar vacante" : "Publicar nueva vacante"}>
      <form onSubmit={submit} className="space-y-6">
        <Card t="1. Puesto">
          <Grid>
            <F l="Título del puesto">
              <Input
                value={f.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="Ej. Asesor Patrimonial Vida"
              />
            </F>
            <F l="Empresa / Promotoría / Broker">
              <Input value={f.company} onChange={(e) => set({ company: e.target.value })} />
            </F>
          </Grid>
          <F l="Logo o imagen representativa de la empresa (opcional)">
            <LogoUploader
              value={f.company_logo_url}
              onChange={(v) => set({ company_logo_url: v })}
              companyName={f.company}
            />
          </F>
          <div>
            <Label className="mb-2 block text-sm">Ramo principal</Label>
            <div className="flex flex-wrap gap-2">
              {RAMOS.map((r) => {
                const on = f.ramos.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() =>
                      set({ ramos: on ? f.ramos.filter((x) => x !== r) : [...f.ramos, r] })
                    }
                    className={`rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
        <Card t="2. Compensación y requisitos">
          <Grid>
            <F l="Tipo de compensación">
              <select
                className={select}
                value={f.pay_scheme}
                onChange={(e) => set({ pay_scheme: e.target.value })}
              >
                {PAY_SCHEMES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </F>
            <F l="Rango salarial estimado">
              <Input
                value={f.salary_text}
                onChange={(e) => set({ salary_text: e.target.value })}
                placeholder="$20,000 – $35,000 + bonos"
              />
            </F>
            <F l="Cédula CNSF requerida">
              <select
                className={select}
                value={f.cedula}
                onChange={(e) => set({ cedula: e.target.value })}
              >
                {CEDULAS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </F>
          </Grid>
        </Card>
        <Card t="3. Ubicación">
          <Grid>
            <F l="Ubicación">
              <Input
                value={f.location}
                onChange={(e) => set({ location: e.target.value })}
                placeholder="Ciudad de México"
              />
            </F>
            <F l="Modalidad">
              <select
                className={select}
                value={f.modality}
                onChange={(e) => set({ modality: e.target.value })}
              >
                {MODALITIES.map((m) => (
                  <option key={m.v} value={m.v}>
                    {m.l}
                  </option>
                ))}
              </select>
            </F>
          </Grid>
        </Card>
        <Card t="4. Detalle">
          <F l="Descripción del puesto">
            <textarea
              rows={4}
              className={area}
              value={f.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </F>
          <F l="Requisitos">
            <textarea
              rows={3}
              className={area}
              value={f.requirements}
              onChange={(e) => set({ requirements: e.target.value })}
            />
          </F>
          <F l="Beneficios">
            <textarea
              rows={3}
              className={area}
              value={f.benefits}
              onChange={(e) => set({ benefits: e.target.value })}
            />
          </F>
        </Card>
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {edit ? "Guardar cambios" : "Publicar vacante"}
          </Button>
        </div>
      </form>
    </RecruiterShell>
  );
}

function Card({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h2 className="font-semibold">{t}</h2>
      {children}
    </section>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}
function F({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm">{l}</Label>
      {children}
    </div>
  );
}
