import { createFileRoute } from "@tanstack/react-router";
import { PrivacyNoticeContent, PRIVACY_POLICY_VERSION } from "@/components/privacy-notice";
import { SiteHeader, SiteFooter } from "@/components/site-header";

export const Route = createFileRoute("/privacidad")({
  head: () => ({
    meta: [
      { title: "Aviso de privacidad — InsurTalent" },
      { name: "description", content: "Consulta el aviso de privacidad de InsurTalent y el tratamiento de datos personales en la plataforma." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Aviso de privacidad</h1>
        <p className="mb-8 mt-3 text-sm text-muted-foreground">Versión {PRIVACY_POLICY_VERSION}</p>
        <PrivacyNoticeContent />
      </main>
      <SiteFooter />
    </div>
  );
}
