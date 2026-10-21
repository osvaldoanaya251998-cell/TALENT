import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { Download, Loader2, RefreshCw, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecruiterShell } from "@/components/recruiter-shell";
import { useSessionRole } from "@/components/site-header";
import { useLanguage } from "@/lib/i18n/provider";
import {
  buildRecruitmentPivot,
  downloadCsv,
  filterApplications,
  RECRUITMENT_STAGES,
  summarizeRecruitment,
} from "@/lib/recruitment-metrics";
import { loadRecruitmentMetrics } from "@/lib/recruitment-metrics-data";
import {
  MetricCard,
  MetricsPanel,
  numberLabel,
  metricInputClass,
  chartTooltipStyle,
} from "@/components/metrics-ui";

export const Route = createFileRoute("/_authenticated/recruiter/metrics")({
  head: () => ({
    meta: [{ title: "Métricas y KPI — InsurTalent" }, { name: "robots", content: "noindex" }],
  }),
  component: RecruitmentMetrics,
});

function RecruitmentMetrics() {
  const { user } = Route.useRouteContext();
  const session = useSessionRole();
  const { tr, language, formatDate } = useLanguage();
  const [data, setData] = useState<Awaited<ReturnType<typeof loadRecruitmentMetrics>> | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [updated, setUpdated] = useState<Date | null>(null);
  const [filters, setFilters] = useState({ from: "", to: "", vacancy: "" });
  const [group, setGroup] = useState<"vacancy" | "stage" | "month">("vacancy");
  const [sort, setSort] = useState("total"),
    [query, setQuery] = useState(""),
    [stage, setStage] = useState("");
  const [page, setPage] = useState(0);
  const sequence = useRef(0);
  const allowed = !!session?.recruiter;
  const load = useCallback(async () => {
    if (!allowed) return;
    const current = ++sequence.current;
    setBusy(true);
    setError(false);
    try {
      const result = await loadRecruitmentMetrics(user.id);
      if (sequence.current === current) {
        setData(result);
        setUpdated(new Date());
      }
    } catch {
      if (sequence.current === current) setError(true);
    } finally {
      if (sequence.current === current) setBusy(false);
    }
  }, [allowed, user.id]);
  useEffect(() => {
    void load();
    window.addEventListener("focus", load);
    return () => {
      sequence.current++;
      window.removeEventListener("focus", load);
    };
  }, [load]);
  useEffect(() => {
    setPage(0);
  }, [filters, query, stage]);
  const invalidDates = !!(filters.from && filters.to && filters.from > filters.to);
  const cohort = useMemo(
    () => filterApplications(data?.applications ?? [], filters),
    [data, filters],
  );
  const summary = useMemo(() => summarizeRecruitment(cohort), [cohort]);
  const names = useMemo(() => new Map(data?.vacancies.map((v) => [v.id, v.title])), [data]);
  const pivot = useMemo(
    () =>
      buildRecruitmentPivot(cohort, data?.vacancies ?? [], group).sort((a, b) =>
        sort === "name"
          ? a.label.localeCompare(b.label)
          : sort === "rate"
            ? b.hiringRate - a.hiringRate
            : b.total - a.total,
      ),
    [cohort, data, group, sort],
  );
  const details = useMemo(
    () =>
      cohort
        .filter(
          (a) =>
            (!stage || a.status === stage) &&
            (!query.trim() ||
              `${a.candidate?.nombre ?? ""} ${names.get(a.vacancy_id ?? "") ?? ""}`
                .toLocaleLowerCase()
                .includes(query.trim().toLocaleLowerCase())),
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [cohort, names, stage, query],
  );
  useEffect(() => {
    setPage((current) => Math.min(current, Math.max(0, Math.ceil(details.length / 20) - 1)));
  }, [details.length]);
  const monthly = useMemo(
    () => buildRecruitmentPivot(cohort, data?.vacancies ?? [], "month"),
    [cohort, data],
  );
  const rate = (value: number) => (summary.total ? `${numberLabel(value, language, 2)}%` : "—");
  const labelFor = (status: string) =>
    tr(RECRUITMENT_STAGES.find((s) => s.value === status)?.label ?? "Sin etapa");
  const pivotLabel = (label: string) =>
    group === "stage" || label === "Sin vacante" || label === "Sin fecha" ? tr(label) : label;
  const exportPivot = () =>
    downloadCsv("insurtalent-kpi.csv", [
      [
        tr(group === "vacancy" ? "Vacante" : group === "stage" ? "Etapa" : "Mes"),
        ...RECRUITMENT_STAGES.map((s) => tr(s.label)),
        tr("Total"),
        tr("Tasa de contratación"),
      ],
      ...pivot.map((row) => [
        pivotLabel(row.label),
        ...RECRUITMENT_STAGES.map((s) => row.counts[s.value] ?? 0),
        row.total,
        `${row.hiringRate.toFixed(2)}%`,
      ]),
    ]);
  return (
    <RecruiterShell
      title="Métricas y KPI"
      action={
        <Button variant="outline" onClick={load} disabled={busy}>
          <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          {tr("Actualizar datos")}
        </Button>
      }
    >
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        {tr(
          "Postulaciones de las vacantes de esta cuenta. Filtra por fecha de postulación y consulta la etapa actual de cada candidato.",
        )}
      </p>
      <div className="mb-6 grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-3">
        <label className="space-y-2 text-sm">
          {tr("Desde")}
          <input
            aria-label={tr("Desde")}
            type="date"
            className={metricInputClass}
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
        </label>
        <label className="space-y-2 text-sm">
          {tr("Hasta")}
          <input
            aria-label={tr("Hasta")}
            type="date"
            className={metricInputClass}
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </label>
        <label className="space-y-2 text-sm">
          {tr("Vacante")}
          <select
            aria-label={tr("Filtrar por vacante")}
            className={metricInputClass}
            value={filters.vacancy}
            onChange={(e) => setFilters({ ...filters, vacancy: e.target.value })}
          >
            <option value="">{tr("Todas mis vacantes")}</option>
            {data?.vacancies.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          {tr("No se pudieron actualizar los indicadores. Intenta de nuevo.")}
        </div>
      )}
      {invalidDates ? (
        <p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm">
          {tr("La fecha inicial debe ser anterior o igual a la fecha final.")}
        </p>
      ) : !data ? (
        <div role="status" className="flex justify-center py-16">
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label={tr("Cargando…")} />
          ) : (
            tr("Sin datos disponibles")
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label={tr("Postulaciones")}
              value={summary.total}
              detail={tr("Cada postulación se cuenta una vez.")}
              testId="kpi-applications"
            />
            <MetricCard
              label={tr("Candidatos identificados")}
              value={summary.people}
              detail={
                summary.unidentified ? (
                  <>
                    {summary.unidentified} {tr("postulaciones sin perfil vinculado")}
                  </>
                ) : (
                  tr("Sin duplicar perfiles entre vacantes.")
                )
              }
            />
            <MetricCard
              label={tr("En proceso")}
              value={summary.inProgress}
              detail={tr("Postulados, revisión, entrevista y oferta.")}
            />
            <MetricCard
              label={tr("Contratados")}
              value={summary.counts.contratado}
              detail={
                <>
                  {tr("Tasa de contratación")}: {rate(summary.hiringRate)}
                </>
              }
              testId="kpi-hired"
            />
          </div>
          <p className="my-4 text-xs text-muted-foreground">
            {tr("Tasa de descarte")}: {rate(summary.rejectionRate)} · {tr("Descartados")}:{" "}
            {summary.counts.rechazado}.{" "}
            {tr(
              "Los porcentajes usan las postulaciones del período seleccionado; no representan el paso acumulado por cada etapa.",
            )}
          </p>
          {summary.total === 0 && (
            <p
              role="status"
              className="mb-6 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground"
            >
              {tr("No hay postulaciones con estos filtros.")}
            </p>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <MetricsPanel
              title={tr("Distribución actual por etapa")}
              description={tr("Cantidad de postulaciones en cada etapa del proceso.")}
            >
              <div className="h-64" role="img" aria-label={tr("Gráfica de candidatos por etapa")}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={RECRUITMENT_STAGES.map((s) => ({
                      name: tr(s.label),
                      total: summary.counts[s.value],
                      color: s.color,
                    }))}
                    margin={{ left: -24, right: 8, bottom: 16 }}
                  >
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    />
                    <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "var(--muted)" }} />
                    <Bar dataKey="total" name={tr("Postulaciones")} radius={[5, 5, 0, 0]}>
                      {RECRUITMENT_STAGES.map((s) => (
                        <Cell key={s.value} fill={s.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {RECRUITMENT_STAGES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStage(stage === s.value ? "" : s.value)}
                    aria-pressed={stage === s.value}
                    className={`rounded-full border px-2.5 py-1 text-xs ${stage === s.value ? "border-primary bg-accent" : "border-border"}`}
                  >
                    {tr(s.label)}: {summary.counts[s.value]}
                  </button>
                ))}
              </div>
            </MetricsPanel>
            <MetricsPanel
              title={tr("Postulaciones por mes")}
              description={tr("Según la fecha en que se recibió cada postulación.")}
            >
              <div className="h-64" role="img" aria-label={tr("Gráfica mensual de postulaciones")}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthly} margin={{ left: -24, right: 12 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Line
                      dataKey="total"
                      name={tr("Postulaciones")}
                      stroke="var(--primary)"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </MetricsPanel>
          </div>
          <div className="mt-6">
            <MetricsPanel
              title={tr("Tabla dinámica")}
              description={tr("Agrupa los datos filtrados y compara sus etapas.")}
            >
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <label className="space-y-1 text-xs">
                  {tr("Agrupar por")}
                  <select
                    aria-label={tr("Agrupar por")}
                    className={metricInputClass}
                    value={group}
                    onChange={(e) => setGroup(e.target.value as typeof group)}
                  >
                    <option value="vacancy">{tr("Vacante")}</option>
                    <option value="stage">{tr("Etapa")}</option>
                    <option value="month">{tr("Mes de postulación")}</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs">
                  {tr("Ordenar por")}
                  <select
                    aria-label={tr("Ordenar por")}
                    className={metricInputClass}
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="total">{tr("Más postulaciones")}</option>
                    <option value="rate">{tr("Mayor tasa de contratación")}</option>
                    <option value="name">{tr("Nombre")}</option>
                  </select>
                </label>
                <Button variant="outline" onClick={exportPivot} disabled={!pivot.length}>
                  <Download className="mr-2 h-4 w-4" />
                  {tr("Exportar tabla CSV")}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table
                  aria-label={tr("Tabla dinámica de reclutamiento")}
                  className="w-full min-w-[820px] text-left text-sm"
                >
                  <thead className="border-b border-border text-xs text-muted-foreground">
                    <tr>
                      <th className="p-3">
                        {tr(group === "vacancy" ? "Vacante" : group === "stage" ? "Etapa" : "Mes")}
                      </th>
                      {RECRUITMENT_STAGES.map((s) => (
                        <th key={s.value} className="p-3 text-right">
                          {tr(s.label)}
                        </th>
                      ))}
                      <th className="p-3 text-right">{tr("Total")}</th>
                      <th className="p-3 text-right">{tr("Contratación %")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pivot.map((row) => (
                      <tr key={row.key}>
                        <td className="p-3 font-medium">{pivotLabel(row.label)}</td>
                        {RECRUITMENT_STAGES.map((s) => (
                          <td key={s.value} className="p-3 text-right tabular-nums">
                            {row.counts[s.value] ?? 0}
                          </td>
                        ))}
                        <td className="p-3 text-right font-semibold">{row.total}</td>
                        <td className="p-3 text-right">
                          {numberLabel(row.hiringRate, language, 2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-border font-semibold">
                    <tr>
                      <td className="p-3">{tr("Total")}</td>
                      {RECRUITMENT_STAGES.map((s) => (
                        <td key={s.value} className="p-3 text-right">
                          {summary.counts[s.value]}
                        </td>
                      ))}
                      <td className="p-3 text-right">{summary.total}</td>
                      <td className="p-3 text-right">{rate(summary.hiringRate)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </MetricsPanel>
          </div>
          <div className="mt-6">
            <MetricsPanel
              title={tr("Seguimiento de candidatos")}
              description={tr("Los filtros de nombre y etapa afectan solo esta tabla.")}
            >
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <input
                  aria-label={tr("Buscar candidato o vacante")}
                  placeholder={tr("Buscar candidato o vacante")}
                  className={`${metricInputClass} sm:col-span-2`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select
                  aria-label={tr("Etapa en la tabla")}
                  className={metricInputClass}
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                >
                  <option value="">{tr("Todas las etapas")}</option>
                  {RECRUITMENT_STAGES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {tr(s.label)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="overflow-x-auto">
                <table
                  aria-label={tr("Seguimiento de candidatos")}
                  className="w-full min-w-[640px] text-left text-sm"
                >
                  <thead className="border-b border-border text-xs text-muted-foreground">
                    <tr>
                      {["Candidato", "Vacante", "Etapa", "Postulación", "Perfil"].map((label) => (
                        <th key={label} className="p-3">
                          {tr(label)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {details.slice(page * 20, (page + 1) * 20).map((app) => (
                      <tr key={app.id}>
                        <td className="p-3 font-medium">
                          {app.candidate?.nombre || tr("Sin nombre")}
                        </td>
                        <td className="p-3">
                          {names.get(app.vacancy_id ?? "") || tr("Sin vacante")}
                        </td>
                        <td className="p-3">{labelFor(app.status)}</td>
                        <td className="p-3">{formatDate(app.created_at)}</td>
                        <td className="p-3">
                          <Link
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                            to="/recruiter/candidates"
                            search={{ vacancy: app.vacancy_id ?? undefined, application: app.id }}
                          >
                            {tr("Ver resumen")}
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!details.length && (
                <p className="py-5 text-center text-sm text-muted-foreground">
                  {tr("Sin resultados con estos filtros.")}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  {details.length} {tr("postulaciones")}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    {tr("Anterior")}
                  </Button>
                  <span>
                    {Math.min(page + 1, Math.max(1, Math.ceil(details.length / 20)))} /{" "}
                    {Math.max(1, Math.ceil(details.length / 20))}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(page + 1) * 20 >= details.length}
                    onClick={() => setPage(page + 1)}
                  >
                    {tr("Siguiente")}
                  </Button>
                </div>
              </div>
            </MetricsPanel>
          </div>
          {updated && (
            <p className="mt-4 text-xs text-muted-foreground">
              {tr("Última actualización")}: {formatDate(updated)} ·{" "}
              <Link to="/recruiter/turnover" className="text-primary hover:underline">
                {tr("Medir rotación de personal")}
              </Link>
            </p>
          )}
        </>
      )}
    </RecruiterShell>
  );
}
