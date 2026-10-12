import { useLanguage } from "@/lib/i18n/provider";
import { MapPin, BadgeCheck, Wallet, Shield } from "lucide-react";
import { modalityLabel, type Vacancy } from "@/lib/insurance";
import { CompanyLogo } from "@/components/company-logo";

export function JobMeta({ v }: { v: Vacancy }) {
  const { tr } = useLanguage();
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <MapPin className="h-3.5 w-3.5" />
        {v.location ?? tr("México")} · {tr(modalityLabel(v.modality))}
      </span>
      <span className="inline-flex items-center gap-1">
        <Wallet className="h-3.5 w-3.5" />
        {tr(v.pay_scheme ?? "—")}
      </span>
      <span className="inline-flex items-center gap-1">
        <BadgeCheck className="h-3.5 w-3.5" />
        {v.cedula === "No requiere" ? tr("Sin cédula") : tr(v.cedula)}
      </span>
    </div>
  );
}

export function JobCard({
  v,
  active,
  onClick,
}: {
  v: Vacancy;
  active?: boolean;
  onClick?: () => void;
}) {
  const { tr } = useLanguage();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border bg-card p-5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/50 ${active ? "border-primary ring-2 ring-primary/20" : "border-border"}`}
    >
      <div className="flex items-start gap-3">
        <CompanyLogo name={v.company} src={v.company_logo_url} size={40} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight">{v.title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{v.company ?? tr("Confidencial")}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {v.ramos.map((r) => (
          <span
            key={r}
            className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground"
          >
            <Shield className="h-3 w-3 text-primary" />
            {tr(r)}
          </span>
        ))}
      </div>
      <div className="mt-3">
        <JobMeta v={v} />
      </div>
      {v.salary_text && (
        <div className="mt-3 text-sm font-semibold text-primary">{v.salary_text}</div>
      )}
    </button>
  );
}
