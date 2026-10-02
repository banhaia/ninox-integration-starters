import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, BarChart3, Table2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  axisProps,
  BAR_RADIUS_HORIZONTAL,
  BAR_RADIUS_VERTICAL,
  chartColors,
  tooltipStyle
} from "@/components/charts/chart-theme";
import { cn } from "@/lib/cn";
import { errorMessage, reports, type MonthlyRow, type ReportCoverage } from "@/lib/api";
import { currentPeriodo, formatCompact, formatMoney, formatNumber, formatPeriodo, shiftPeriodo } from "@/lib/format";

type Monthly = { months: MonthlyRow[]; coverage: ReportCoverage };
type TopItem = { codigo: string; descripcion: string; unidades: number; importe: number };
type PaymentItem = { tipo: number; medio: string; importe: number };

function variation(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function KpiTile({
  label,
  value,
  previous,
  current,
  hint
}: {
  label: string;
  value: string;
  current: number;
  previous: number;
  hint?: string;
}) {
  const delta = variation(current, previous);
  const up = delta !== null && delta >= 0;
  return (
    <Card className="space-y-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {delta === null ? (
          "sin dato del mes anterior"
        ) : (
          <>
            {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            <span className="font-medium text-foreground">
              {up ? "+" : ""}
              {delta.toFixed(1)}%
            </span>
            vs. mes anterior
          </>
        )}
      </p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

function ChartCard({ title, subtitle, children, empty }: { title: string; subtitle?: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {empty ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          Sin datos para este período
        </div>
      ) : (
        <div className="h-72">{children}</div>
      )}
    </Card>
  );
}

const moneyTooltip = (value: unknown) => formatMoney(Number(value ?? 0));

export function ReportsPage() {
  const [mes, setMes] = useState(currentPeriodo());
  const [sucursalId, setSucursalId] = useState<number | "">("");
  const [sucursales, setSucursales] = useState<Array<{ sucursalId: number; nombre: string }>>([]);
  const [monthly, setMonthly] = useState<Monthly | null>(null);
  const [top, setTop] = useState<TopItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [showTable, setShowTable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reports
      .sucursales()
      .then((data) => setSucursales(data.items))
      .catch(() => setSucursales([]));
  }, []);

  useEffect(() => {
    const filters = { sucursalId: sucursalId || undefined };
    setError(null);
    Promise.all([
      reports.monthly({ desde: shiftPeriodo(mes, -11), hasta: mes, ...filters }),
      reports.topProducts({ mes, ...filters }),
      reports.paymentMethods({ mes, ...filters })
    ])
      .then(([monthlyData, topData, paymentData]) => {
        setMonthly(monthlyData);
        setTop(topData.items);
        setPayments(paymentData.items);
      })
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [mes, sucursalId]);

  const chartData = useMemo(
    () => (monthly?.months ?? []).map((row) => ({ ...row, label: formatPeriodo(row.periodo, false) })),
    [monthly]
  );

  const current = monthly?.months.at(-1);
  const previous = monthly?.months.at(-2);
  const hasAnyData = Boolean(
    monthly && (monthly.coverage.ventasTotales.length > 0 || monthly.coverage.ventasItems.length > 0 || monthly.coverage.comprasTotales.length > 0)
  );

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Reportes</h1>
            <p className="text-sm text-muted-foreground">Indicadores mensuales calculados sobre los datos ingestados.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="month" className="h-9 w-44" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} />
          <Select
            className="h-9 w-48"
            value={sucursalId === "" ? "" : String(sucursalId)}
            onChange={(e) => setSucursalId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Todas las sucursales</option>
            {sucursales.map((s) => (
              <option key={s.sucursalId} value={s.sucursalId}>
                {s.nombre}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {error ? <Card className="text-sm text-red-700">{error}</Card> : null}

      {monthly && !hasAnyData ? (
        <Card className="text-sm">
          Todavía no hay datos importados. Andá a{" "}
          <Link to="/ingesta" className="font-medium underline">
            Ingesta
          </Link>{" "}
          e importá ventas y compras de los últimos meses para ver los reportes.
        </Card>
      ) : null}

      {current && previous ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            label={`Ventas netas · ${formatPeriodo(current.periodo)}`}
            value={formatMoney(current.ventasNetas)}
            current={current.ventasNetas}
            previous={previous.ventasNetas}
            hint={current.notasCredito ? `Incluye ${formatMoney(current.notasCredito)} en notas de crédito` : undefined}
          />
          <KpiTile
            label="Comprobantes de venta"
            value={formatNumber(current.comprobantes)}
            current={current.comprobantes}
            previous={previous.comprobantes}
            hint={`Ticket promedio ${formatMoney(current.ticketPromedio)}`}
          />
          <KpiTile
            label="Unidades vendidas"
            value={formatNumber(current.unidades)}
            current={current.unidades}
            previous={previous.unidades}
            hint={current.margenPorcentaje !== null ? `Margen bruto estimado ${current.margenPorcentaje.toFixed(1)}%` : undefined}
          />
          <KpiTile
            label="Compras netas"
            value={formatMoney(current.comprasNetas)}
            current={current.comprasNetas}
            previous={previous.comprasNetas}
            hint={`${formatNumber(current.comprobantesCompra)} comprobantes`}
          />
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Ventas y compras netas" subtitle="Últimos 12 meses, en pesos" empty={!hasAnyData}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={2} barCategoryGap="24%">
              <CartesianGrid vertical={false} stroke={chartColors.grid} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} width={56} tickFormatter={(v: number) => formatCompact(v)} />
              <Tooltip {...tooltipStyle} formatter={moneyTooltip} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: chartColors.textSecondary }} />
              <Bar dataKey="ventasNetas" name="Ventas" fill={chartColors.series1} radius={BAR_RADIUS_VERTICAL} maxBarSize={22} />
              <Bar dataKey="comprasNetas" name="Compras" fill={chartColors.series2} radius={BAR_RADIUS_VERTICAL} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Ticket promedio" subtitle="Venta bruta / cantidad de comprobantes" empty={!hasAnyData}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid vertical={false} stroke={chartColors.grid} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} width={56} tickFormatter={(v: number) => formatCompact(v)} />
              <Tooltip {...tooltipStyle} formatter={moneyTooltip} />
              <Line
                type="monotone"
                dataKey="ticketPromedio"
                name="Ticket promedio"
                stroke={chartColors.series1}
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2, stroke: "#fff", fill: chartColors.series1 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={`Top 10 artículos · ${formatPeriodo(mes)}`} subtitle="Por importe neto vendido" empty={top.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} stroke={chartColors.grid} />
              <XAxis type="number" {...axisProps} tickFormatter={(v: number) => formatCompact(v)} />
              <YAxis
                type="category"
                dataKey="codigo"
                {...axisProps}
                width={96}
                tickFormatter={(v: string) => (v.length > 12 ? `${v.slice(0, 12)}…` : v)}
              />
              <Tooltip
                {...tooltipStyle}
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                formatter={(value: unknown, _name, item) => [
                  `${formatMoney(Number(value ?? 0))} · ${formatNumber((item.payload as TopItem).unidades)} u.`,
                  (item.payload as TopItem).descripcion || "Importe"
                ]}
              />
              <Bar dataKey="importe" name="Importe" fill={chartColors.series1} radius={BAR_RADIUS_HORIZONTAL} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={`Medios de pago · ${formatPeriodo(mes)}`} subtitle="Importe neto cobrado por medio" empty={payments.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={payments} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} stroke={chartColors.grid} />
              <XAxis type="number" {...axisProps} tickFormatter={(v: number) => formatCompact(v)} />
              <YAxis type="category" dataKey="medio" {...axisProps} width={110} />
              <Tooltip {...tooltipStyle} formatter={moneyTooltip} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="importe" name="Importe" fill={chartColors.series1} radius={BAR_RADIUS_HORIZONTAL} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {monthly ? (
        <Card className="overflow-x-auto">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Detalle mensual</h2>
            <Button variant="ghost" className="h-8 gap-1.5 px-3 text-xs" onClick={() => setShowTable((v) => !v)}>
              <Table2 className="h-3.5 w-3.5" />
              {showTable ? "Ocultar tabla" : "Ver tabla"}
            </Button>
          </div>
          {showTable ? (
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-right text-xs uppercase text-muted-foreground">
                  <th className="pb-2 text-left font-medium">Mes</th>
                  <th className="pb-2 font-medium">Ventas netas</th>
                  <th className="pb-2 font-medium">NC</th>
                  <th className="pb-2 font-medium">Comprob.</th>
                  <th className="pb-2 font-medium">Ticket prom.</th>
                  <th className="pb-2 font-medium">Unidades</th>
                  <th className="pb-2 font-medium">Margen est.</th>
                  <th className="pb-2 font-medium">Compras netas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {[...monthly.months].reverse().map((row) => (
                  <tr key={row.periodo} className={cn("text-right", row.periodo === mes && "font-semibold")}>
                    <td className="py-2 text-left">{formatPeriodo(row.periodo)}</td>
                    <td className="py-2">{formatMoney(row.ventasNetas)}</td>
                    <td className="py-2">{formatMoney(row.notasCredito)}</td>
                    <td className="py-2">{formatNumber(row.comprobantes)}</td>
                    <td className="py-2">{formatMoney(row.ticketPromedio)}</td>
                    <td className="py-2">{formatNumber(row.unidades)}</td>
                    <td className="py-2">{row.margenPorcentaje === null ? "—" : `${row.margenPorcentaje.toFixed(1)}%`}</td>
                    <td className="py-2">{formatMoney(row.comprasNetas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">
              Las ventas netas salen de los totales de comprobante (facturas menos notas de crédito). Unidades y margen
              estimado salen de los ítems: margen = (precio final − costo) × cantidad.
            </p>
          )}
        </Card>
      ) : null}
    </div>
  );
}
