import type { ReactNode } from "react";

export function numberLabel(value: number, language: string, decimals = 0) {
  try {
    return value.toLocaleString(language, { maximumFractionDigits: decimals });
  } catch {
    return value.toLocaleString("es-MX", { maximumFractionDigits: decimals });
  }
}
export function monthLabel(month: string, language: string) {
  const date = new Date(`${month.slice(0, 7)}-15T12:00:00`);
  try {
    return date.toLocaleDateString(language, { month: "long", year: "numeric" });
  } catch {
    return date.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  }
}
export function MetricCard({
  label,
  value,
  detail,
  testId,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  testId?: string;
}) {
  return (
    <div data-testid={testId} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <h2 className="text-sm font-medium text-muted-foreground">{label}</h2>
      <div className="mt-3 text-3xl font-bold tabular-nums text-foreground">{value}</div>
      {detail && <div className="mt-2 text-xs leading-relaxed text-muted-foreground">{detail}</div>}
    </div>
  );
}
export function MetricsPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-soft md:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}
export const chartTooltipStyle = {
  backgroundColor: "var(--card)",
  color: "var(--foreground)",
  border: "1px solid var(--border)",
  borderRadius: 12,
};
export const metricInputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground";
