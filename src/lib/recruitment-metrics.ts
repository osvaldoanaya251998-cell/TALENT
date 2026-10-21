export const RECRUITMENT_STAGES = [
  { value: "nuevo", label: "Postulados", color: "#64748b" },
  { value: "revisando", label: "En revisión", color: "#3b82f6" },
  { value: "entrevista", label: "Entrevista", color: "#8b5cf6" },
  { value: "aprobado", label: "Oferta", color: "#d97706" },
  { value: "contratado", label: "Contratado", color: "#059669" },
  { value: "rechazado", label: "Descartado", color: "#e11d48" },
] as const;

export type MetricVacancy = { id: string; title: string; is_active: boolean };
export type MetricApplication = {
  id: string;
  vacancy_id: string | null;
  candidate_id: string | null;
  user_id: string | null;
  status: string;
  created_at: string;
  candidate: { nombre: string } | null;
};
export type MetricFilters = { from: string; to: string; vacancy: string };
export type PivotRow = {
  key: string;
  label: string;
  total: number;
  counts: Record<string, number>;
  hiringRate: number;
};

export function filterApplications(apps: MetricApplication[], filters: MetricFilters) {
  const start = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : -Infinity;
  const endDate = filters.to ? new Date(`${filters.to}T00:00:00`) : null;
  if (endDate) endDate.setDate(endDate.getDate() + 1);
  const end = endDate?.getTime() ?? Infinity;
  return apps.filter(
    (app) =>
      (!filters.vacancy || app.vacancy_id === filters.vacancy) &&
      ((!filters.from && !filters.to) ||
        (new Date(app.created_at).getTime() >= start && new Date(app.created_at).getTime() < end)),
  );
}

export function summarizeRecruitment(apps: MetricApplication[]) {
  const counts = Object.fromEntries(RECRUITMENT_STAGES.map((stage) => [stage.value, 0]));
  const candidateByUser = new Map(
    apps.filter((a) => a.user_id && a.candidate_id).map((a) => [a.user_id!, a.candidate_id!]),
  );
  const people = new Set<string>();
  let unidentified = 0;
  for (const app of apps) {
    counts[app.status] = (counts[app.status] ?? 0) + 1;
    const identity =
      app.candidate_id ??
      (app.user_id ? (candidateByUser.get(app.user_id) ?? `user:${app.user_id}`) : null);
    if (identity) people.add(identity);
    else unidentified++;
  }
  return {
    total: apps.length,
    people: people.size,
    unidentified,
    counts,
    inProgress: counts.nuevo + counts.revisando + counts.entrevista + counts.aprobado,
    hiringRate: apps.length ? (counts.contratado / apps.length) * 100 : 0,
    rejectionRate: apps.length ? (counts.rechazado / apps.length) * 100 : 0,
  };
}

export function localMonth(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime())
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    : "";
}

export function buildRecruitmentPivot(
  apps: MetricApplication[],
  vacancies: MetricVacancy[],
  group: "vacancy" | "stage" | "month",
): PivotRow[] {
  const names = new Map(vacancies.map((v) => [v.id, v.title]));
  const groups = new Map<string, PivotRow>();
  for (const app of apps) {
    const key =
      group === "vacancy"
        ? (app.vacancy_id ?? "")
        : group === "stage"
          ? app.status
          : localMonth(app.created_at);
    const label =
      group === "vacancy"
        ? (names.get(key) ?? "Sin vacante")
        : group === "stage"
          ? (RECRUITMENT_STAGES.find((s) => s.value === key)?.label ?? "Sin etapa")
          : key || "Sin fecha";
    const row = groups.get(key) ?? { key, label, total: 0, counts: {}, hiringRate: 0 };
    row.total++;
    row.counts[app.status] = (row.counts[app.status] ?? 0) + 1;
    row.hiringRate = ((row.counts.contratado ?? 0) / row.total) * 100;
    groups.set(key, row);
  }
  return [...groups.values()].sort((a, b) =>
    group === "month"
      ? a.key.localeCompare(b.key)
      : b.total - a.total || a.label.localeCompare(b.label),
  );
}

export function csvContent(rows: (string | number)[][]) {
  const escape = (value: string | number) => {
    const text = String(value);
    const safe = /^[\s]*[=+@-]/u.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const url = URL.createObjectURL(new Blob([csvContent(rows)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
