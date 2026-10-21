import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Loader2, RefreshCw, Save, Pencil } from "lucide-react";
import { toast } from "sonner";
import { RecruiterShell } from "@/components/recruiter-shell";
import { useSessionRole } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/provider";
import { collectPages } from "@/lib/recruitment-metrics-data";
import { downloadCsv } from "@/lib/recruitment-metrics";
import {
  calculateTurnover,
  turnoverStorageMissing,
  workforceClient,
  type WorkforcePeriod,
} from "@/lib/workforce";
import {
  MetricCard,
  MetricsPanel,
  numberLabel,
  monthLabel,
  metricInputClass,
  chartTooltipStyle,
} from "@/components/metrics-ui";

export const Route = createFileRoute("/_authenticated/recruiter/turnover")({
  head: () => ({
    meta: [{ title: "Rotación de personal — InsurTalent" }, { name: "robots", content: "noindex" }],
  }),
  component: TurnoverDashboard,
});
const fields = [
  { key: "start", label: "Plantilla inicial", help: "Personas activas al inicio del mes." },
  { key: "hires", label: "Altas del mes", help: "Personas que se incorporaron a la empresa." },
  {
    key: "departures",
    label: "Bajas del mes",
    help: "Personas que dejaron la empresa durante el mes.",
  },
] as const;

function TurnoverDashboard() {
  const { user } = Route.useRouteContext();
  const session = useSessionRole();
  const { tr, language } = useLanguage();
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [draft, setDraft] = useState({
    month: currentMonth,
    start: "",
    hires: "0",
    departures: "0",
    target: "",
    notes: "",
  });
  const [records, setRecords] = useState<WorkforcePeriod[]>([]);
  const [storage, setStorage] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const sequence = useRef(0);
  const allowed = !!session?.recruiter;
  const load = useCallback(async () => {
    if (!allowed) return;
    const current = ++sequence.current;
    setLoading(true);
    try {
      const periods = await collectPages<WorkforcePeriod>(async (from, to) => {
        const result = await workforceClient
          .from("recruiter_workforce_periods")
          .select("*", { count: "exact" })
          .eq("owner_id", user.id)
          .order("month", { ascending: false })
          .range(from, to);
        if (result.error) throw result.error;
        return { rows: result.data ?? [], total: result.count };
      });
      if (current === sequence.current) {
        setRecords(periods);
        setStorage("ready");
      }
    } catch (error) {
      if (current === sequence.current)
        setStorage(turnoverStorageMissing(error as { code?: string }) ? "missing" : "error");
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [allowed, user.id]);
  useEffect(() => {
    void load();
    return () => {
      sequence.current++;
    };
  }, [load]);
  const numeric = (value: string) => (value.trim() ? Number(value) : NaN);
  const result = calculateTurnover(
    numeric(draft.start),
    numeric(draft.hires),
    numeric(draft.departures),
  );
  const target = draft.target.trim() ? Number(draft.target) : null;
  const targetValid =
    target === null || (Number.isFinite(target) && target >= 0 && target <= 10000);
  const percentage = (rate: number | null) =>
    rate === null ? "—" : `${numberLabel(rate, language, 2)}%`;
  const verdict = (rate: number | null, goal: number | null) =>
    rate === null
      ? "No calculable"
      : goal === null
        ? "Sin meta"
        : rate <= goal
          ? "Dentro de meta"
          : "Sobre la meta";
  const existing = records.find((row) => row.month.slice(0, 7) === draft.month);
  const previousDate = new Date(`${draft.month}-15T12:00:00`);
  previousDate.setMonth(previousDate.getMonth() - 1);
  const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`;
  const previous = records.find((row) => row.month.startsWith(previousMonth));
  const filtered = useMemo(
    () =>
      records
        .filter((row) => Number(row.month.slice(0, 4)) === year)
        .sort((a, b) => b.month.localeCompare(a.month)),
    [records, year],
  );
  const years = [
    ...new Set([new Date().getFullYear(), ...records.map((row) => Number(row.month.slice(0, 4)))]),
  ].sort((a, b) => b - a);
  const chart = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const period = records.find((row) => row.month.startsWith(month));
    return {
      month,
      rate: period
        ? (calculateTurnover(period.headcount_start, period.hires, period.departures)?.rate ?? null)
        : null,
      goal: period?.target_percent ?? null,
    };
  });
  const edit = (row: WorkforcePeriod) => {
    setDraft({
      month: row.month.slice(0, 7),
      start: String(row.headcount_start),
      hires: String(row.hires),
      departures: String(row.departures),
      target: row.target_percent === null ? "" : String(row.target_percent),
      notes: row.notes ?? "",
    });
    document
      .getElementById("turnover-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!result || !targetValid || !/^\d{4}-(0[1-9]|1[0-2])$/.test(draft.month)) return;
    setSaving(true);
    const payload = {
      owner_id: user.id,
      month: `${draft.month}-01`,
      headcount_start: numeric(draft.start),
      hires: numeric(draft.hires),
      departures: numeric(draft.departures),
      target_percent: target,
      notes: draft.notes.trim() || null,
    };
    try {
      const response = await workforceClient
        .from("recruiter_workforce_periods")
        .upsert(payload, { onConflict: "owner_id,month" })
        .select()
        .single();
      if (response.error) throw response.error;
      setRecords((rows) => [
        response.data,
        ...rows.filter((row) => row.month !== response.data.month),
      ]);
      setYear(Number(draft.month.slice(0, 4)));
      setStorage("ready");
      toast.success(tr("Indicador mensual guardado"));
    } catch (error) {
      if (turnoverStorageMissing(error as { code?: string })) setStorage("missing");
      toast.error(tr("No se pudo guardar el período. Tus datos siguen en el formulario."));
    } finally {
      setSaving(false);
    }
  };
  const exportHistory = () =>
    downloadCsv("insurtalent-rotacion.csv", [
      [
        tr("Mes"),
        tr("Plantilla inicial"),
        tr("Altas"),
        tr("Bajas"),
        tr("Plantilla final"),
        tr("Plantilla promedio"),
        tr("Rotación %"),
        tr("Meta %"),
      ],
      ...filtered.map((row) => {
        const calculation = calculateTurnover(row.headcount_start, row.hires, row.departures)!;
        return [
          row.month.slice(0, 7),
          row.headcount_start,
          row.hires,
          row.departures,
          row.headcount_end,
          calculation.average,
          calculation.rate === null ? "" : calculation.rate.toFixed(2),
          row.target_percent ?? "",
        ];
      }),
    ]);
  return (
    <RecruiterShell
      title="Rotación de personal"
      action={
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {tr("Actualizar historial")}
        </Button>
      }
    >
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        {tr(
          "Mide las bajas reales de tu empresa por mes. Las contrataciones o descartes del proceso de candidatos no se suman automáticamente a la plantilla.",
        )}
      </p>
      {storage === "missing" && (
        <div
          role="status"
          className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm"
        >
          {tr(
            "Puedes calcular tu rotación. El historial compartido aún no está activado; solicita su activación al administrador.",
          )}
        </div>
      )}
      {storage === "error" && (
        <div role="alert" className="mb-6 rounded-xl border border-destructive/30 p-4 text-sm">
          {tr("No se pudo cargar el historial. Puedes seguir calculando y volver a intentar.")}
        </div>
      )}
      <form
        id="turnover-form"
        onSubmit={save}
        className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 shadow-soft md:p-6"
      >
        <h2 className="text-lg font-semibold">{tr("Registro mensual de plantilla")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr("Captura los datos reales del mes; el cálculo se actualiza mientras escribes.")}
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-2 text-sm">
            {tr("Mes del indicador")}
            <input
              className={metricInputClass}
              aria-label={tr("Mes del indicador")}
              type="month"
              value={draft.month}
              onChange={(e) => {
                const saved = records.find((row) => row.month.slice(0, 7) === e.target.value);
                if (saved) edit(saved);
                else
                  setDraft({
                    month: e.target.value,
                    start: "",
                    hires: "0",
                    departures: "0",
                    target: "",
                    notes: "",
                  });
              }}
              required
            />
            <span className="block text-xs text-muted-foreground">
              {existing
                ? tr("Este mes ya existe. Al guardar se actualizará.")
                : tr("Nuevo período")}
            </span>
          </label>
          {fields.map((field) => (
            <label key={field.key} className="space-y-2 text-sm">
              {tr(field.label)}
              <input
                className={metricInputClass}
                aria-label={tr(field.label)}
                type="number"
                min="0"
                max="10000000"
                step="1"
                value={draft[field.key]}
                onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                required
              />
              <span className="block text-xs text-muted-foreground">{tr(field.help)}</span>
            </label>
          ))}
        </div>
        {draft.start.trim() && !result && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {tr(
              "Usa cantidades enteras no negativas. Las bajas no pueden superar la plantilla inicial más las altas.",
            )}
          </p>
        )}
        {previous && draft.start.trim() && previous.headcount_end !== numeric(draft.start) && (
          <p className="mt-4 text-xs text-amber-700 dark:text-amber-300">
            {tr(
              "El inicio de este mes difiere del cierre anterior. Confirma tus cifras si hubo ajustes.",
            )}
          </p>
        )}
        <div className="mt-5 grid gap-5 sm:grid-cols-[220px_1fr]">
          <label className="space-y-2 text-sm">
            {tr("Meta de rotación % (opcional)")}
            <input
              className={metricInputClass}
              aria-label={tr("Meta de rotación % (opcional)")}
              type="number"
              min="0"
              max="10000"
              step="0.01"
              placeholder="3"
              value={draft.target}
              onChange={(e) => setDraft({ ...draft, target: e.target.value })}
            />
            <span className="block text-xs text-muted-foreground">
              {tr("Tu límite mensual deseado; no es una referencia del mercado.")}
            </span>
          </label>
          <label className="space-y-2 text-sm">
            {tr("Notas del período (opcional)")}
            <textarea
              className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              aria-label={tr("Notas del período (opcional)")}
              maxLength={2000}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {tr("La vista previa se guarda únicamente al pulsar el botón.")}
          </span>
          <Button
            type="submit"
            disabled={!result || !targetValid || saving || loading || storage !== "ready"}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {tr("Guardar período")}
          </Button>
        </div>
      </form>
      <h2 className="mb-3 mt-7 text-sm font-semibold text-muted-foreground">
        {tr("Vista previa del período")}
        {draft.month && <> · {monthLabel(draft.month, language)}</>}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={tr("Plantilla final")}
          value={result?.end ?? "—"}
          detail={tr("Plantilla inicial + altas − bajas.")}
          testId="turnover-end"
        />
        <MetricCard
          label={tr("Plantilla promedio")}
          value={result ? numberLabel(result.average, language, 2) : "—"}
          detail={tr("Promedio de la plantilla inicial y final.")}
        />
        <MetricCard
          label={tr("Rotación por bajas")}
          value={result ? percentage(result.rate) : "—"}
          detail={tr("Bajas ÷ plantilla promedio × 100.")}
          testId="turnover-rate"
        />
        <MetricCard
          label={tr("Indicador de meta")}
          value={tr(result && targetValid ? verdict(result.rate, target) : "Sin datos")}
          detail={
            target !== null && targetValid ? (
              <>
                {tr("Meta")}: {percentage(target)}
              </>
            ) : (
              tr("Define una meta propia para comparar.")
            )
          }
          testId="turnover-goal"
        />
      </div>
      {result?.rate === null && (
        <p className="mt-4 text-sm text-muted-foreground">
          {tr(
            "Con una plantilla promedio de cero no se puede calcular el porcentaje. No se muestra como 0%.",
          )}
        </p>
      )}
      <div className="my-7 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        {tr(
          "Este indicador usa bajas divididas entre la plantilla promedio. Puede superar el 100% si hubo varias sustituciones durante el mes.",
        )}
      </div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <label className="space-y-1 text-sm">
          {tr("Año del historial")}
          <select
            aria-label={tr("Año del historial")}
            className={metricInputClass}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" disabled={!filtered.length} onClick={exportHistory}>
          <Download className="mr-2 h-4 w-4" />
          {tr("Exportar historial CSV")}
        </Button>
      </div>
      <MetricsPanel
        title={tr("Dashboard de rotación mensual")}
        description={tr("Solo períodos guardados. Los meses sin registro aparecen sin dato.")}
      >
        {!filtered.length ? (
          <p role="status" className="py-12 text-center text-sm text-muted-foreground">
            {loading ? tr("Cargando…") : tr("Aún no hay períodos guardados en este año.")}
          </p>
        ) : (
          <div className="h-72" role="img" aria-label={tr("Gráfica de rotación mensual")}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ left: 0, right: 12 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <YAxis unit="%" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value: number, name: string) => [
                    `${numberLabel(value, language, 2)}%`,
                    name,
                  ]}
                />
                <Line
                  dataKey="rate"
                  name={tr("Rotación %")}
                  stroke="var(--primary)"
                  strokeWidth={3}
                  connectNulls={false}
                />
                <Line
                  dataKey="goal"
                  name={tr("Meta %")}
                  stroke="#d97706"
                  strokeDasharray="5 5"
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>{tr("Rotación %")}</span>
          <span>{tr("Meta %")}</span>
          <span>
            {filtered.length} {tr("meses registrados")} · {tr("Altas")}:{" "}
            {filtered.reduce((sum, row) => sum + row.hires, 0)} · {tr("Bajas")}:{" "}
            {filtered.reduce((sum, row) => sum + row.departures, 0)}
          </span>
        </div>
      </MetricsPanel>
      <div className="mt-6">
        <MetricsPanel
          title={tr("Historial de indicadores")}
          description={tr("Cada mes se guarda una vez y puede editarse.")}
        >
          <div className="overflow-x-auto">
            <table
              aria-label={tr("Historial de indicadores")}
              className="w-full min-w-[840px] text-left text-sm"
            >
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  {[
                    "Mes",
                    "Plantilla inicial",
                    "Altas",
                    "Bajas",
                    "Cierre",
                    "Rotación %",
                    "Meta %",
                    "Indicador",
                    "Acciones",
                  ].map((label) => (
                    <th className="p-3" key={label}>
                      {tr(label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((row) => {
                  const rate =
                    calculateTurnover(row.headcount_start, row.hires, row.departures)?.rate ?? null;
                  return (
                    <tr key={row.id}>
                      <td className="p-3 font-medium">{monthLabel(row.month, language)}</td>
                      <td className="p-3">{row.headcount_start}</td>
                      <td className="p-3">{row.hires}</td>
                      <td className="p-3">{row.departures}</td>
                      <td className="p-3">{row.headcount_end}</td>
                      <td className="p-3">{percentage(rate)}</td>
                      <td className="p-3">{percentage(row.target_percent)}</td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${rate === null || row.target_percent === null ? "bg-muted text-muted-foreground" : rate <= row.target_percent ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-amber-500/10 text-amber-800 dark:text-amber-300"}`}
                        >
                          {tr(verdict(rate, row.target_percent))}
                        </span>
                      </td>
                      <td className="p-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => edit(row)}
                          aria-label={`${tr("Editar período")} ${row.month.slice(0, 7)}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </MetricsPanel>
      </div>
    </RecruiterShell>
  );
}
