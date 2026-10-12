import { useLanguage } from "@/lib/i18n/provider";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck } from "lucide-react";

export const PRIVACY_POLICY_VERSION = "2026-01-v1";

export function PrivacyNoticeContent() {
  const { tr } = useLanguage();
  return (
    <div className="space-y-6 text-sm leading-relaxed text-foreground/90">
      <p>
        {tr(
          "En cumplimiento con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares, informamos que los datos personales recopilados a través de esta plataforma serán utilizados exclusivamente para fines relacionados con procesos de reclutamiento, evaluaciones técnicas, análisis de perfil profesional, seguimiento de candidatos y gestión de talento.",
        )}
      </p>

      <Section title={tr("Datos personales recopilados")}>
        <p>{tr("Podremos solicitar y almacenar información como:")}</p>
        <Bullets
          items={[
            "Nombre completo",
            "Correo electrónico",
            "Número telefónico",
            "Información laboral y académica",
            "Currículum Vitae (CV)",
            "Resultados de evaluaciones técnicas y psicométricas",
            "Información proporcionada voluntariamente por el usuario durante el proceso de postulación",
          ]}
        />
      </Section>

      <Section title={tr("Finalidad del tratamiento de datos")}>
        <p>{tr("La información recopilada será utilizada para:")}</p>
        <Bullets
          items={[
            "Evaluar perfiles profesionales y competencias laborales",
            "Gestionar procesos de reclutamiento y selección",
            "Contactar candidatos para entrevistas o seguimiento",
            "Generar reportes internos, métricas y análisis de desempeño",
            "Mejorar la experiencia y funcionamiento de la plataforma",
            "Validar compatibilidad con vacantes y posiciones disponibles",
          ]}
        />
      </Section>

      <Section title={tr("Protección de la información")}>
        <p>
          {tr(
            "La información proporcionada será almacenada mediante herramientas y sistemas con medidas razonables de seguridad administrativa, técnica y digital. El acceso a la información estará limitado únicamente a personal autorizado relacionado con procesos de reclutamiento y administración de la plataforma.",
          )}
        </p>
      </Section>

      <Section title={tr("Conservación de la información")}>
        <p>
          {tr(
            "Los datos podrán conservarse durante el tiempo necesario para fines de evaluación, seguimiento de candidatos, cumplimiento legal o futuras oportunidades laborales, salvo que el titular solicite su eliminación.",
          )}
        </p>
      </Section>

      <Section title={tr("Derechos ARCO")}>
        <p>
          {tr(
            "El titular de los datos personales podrá solicitar en cualquier momento el acceso, rectificación, cancelación u oposición del tratamiento de sus datos personales (Derechos ARCO), enviando una solicitud mediante los canales oficiales de contacto de la plataforma.",
          )}
        </p>
      </Section>

      <Section title={tr("Uso de cookies y tecnologías similares")}>
        <p>
          {tr(
            "La plataforma podrá utilizar cookies, herramientas analíticas o tecnologías similares para mejorar la experiencia del usuario, analizar comportamiento dentro del sistema y generar estadísticas de uso.",
          )}
        </p>
      </Section>

      <Section title={tr("Modificaciones al aviso de privacidad")}>
        <p>
          {tr(
            "Nos reservamos el derecho de actualizar o modificar el presente Aviso de Privacidad en cualquier momento para cumplir con cambios legales, regulatorios o mejoras operativas de la plataforma.",
          )}
        </p>
        <p>{tr("Las modificaciones estarán disponibles dentro de esta misma plataforma.")}</p>
      </Section>

      <Section title={tr("Consentimiento")}>
        <p>
          {tr(
            "Al registrarse, postularse o utilizar esta plataforma, el usuario acepta el tratamiento de sus datos personales conforme al presente Aviso de Privacidad.",
          )}
        </p>
      </Section>

      <Section title={tr("Contacto")}>
        <p>
          {tr(
            "Para cualquier duda, aclaración o solicitud relacionada con este Aviso de Privacidad y el tratamiento de datos personales, el usuario podrá comunicarse mediante los canales oficiales de contacto de la plataforma.",
          )}
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { tr } = useLanguage();
  return (
    <section className="space-y-2">
      <h3 className="text-base font-semibold tracking-tight text-foreground">{tr(title)}</h3>
      <div className="space-y-2 text-muted-foreground">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  const { tr } = useLanguage();
  return (
    <ul className="ml-5 list-disc space-y-1">
      {items.map((it) => (
        <li key={it}>{tr(it)}</li>
      ))}
    </ul>
  );
}

export function PrivacyNoticeModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { tr } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">{tr("Aviso de Privacidad")}</DialogTitle>
              <DialogDescription className="text-xs">
                {tr("Versión")} {PRIVACY_POLICY_VERSION}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="mt-2 max-h-[65vh] overflow-y-auto rounded-xl border border-border bg-background/60 p-5 pr-6">
          <PrivacyNoticeContent />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PrivacyConsentCheckbox({
  checked,
  onCheckedChange,
  id = "privacy-consent",
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  id?: string;
}) {
  const { tr } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-start gap-3 rounded-xl border border-border bg-background/50 p-4">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          className="mt-0.5"
        />
        <label htmlFor={id} className="cursor-pointer text-sm leading-relaxed text-foreground/90">
          {tr("He leído y acepto el")}{" "}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setOpen(true);
            }}
            className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
          >
            {tr("Aviso de Privacidad")}
          </button>{" "}
          {tr("y el tratamiento de mis datos personales.")}
        </label>
      </div>
      <PrivacyNoticeModal open={open} onOpenChange={setOpen} />
    </>
  );
}
