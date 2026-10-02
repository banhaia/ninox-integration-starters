import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, DownloadCloud, FileDown, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { errorMessage, ingest, type CoverageRow, type IngestJob, type IngestType, type IngestTypeInfo } from "@/lib/api";
import { currentPeriodo, formatDateTime, formatNumber, formatPeriodo, shiftPeriodo } from "@/lib/format";

const JOB_STATUS: Record<IngestJob["status"], { label: string; className: string }> = {
  queued: { label: "En cola", className: "bg-zinc-200 text-zinc-700" },
  running: { label: "Descargando", className: "bg-sky-100 text-sky-700" },
  done: { label: "Listo", className: "bg-emerald-100 text-emerald-700" },
  failed: { label: "Falló", className: "bg-red-100 text-red-700" },
  cancelled: { label: "Cancelado", className: "bg-zinc-200 text-zinc-600" }
};

const CSV_TABLES = [
  { table: "ventas_items", label: "Ventas · ítems" },
  { table: "ventas_totales", label: "Ventas · totales" },
  { table: "compras_items", label: "Compras · ítems" },
  { table: "compras_totales", label: "Compras · totales" }
];

type Options = Awaited<ReturnType<typeof ingest.options>>;

function JobProgress({ job }: { job: IngestJob }) {
  const pct = job.totalPages ? Math.round((job.page / Math.max(job.totalPages, 1)) * 100) : job.status === "done" ? 100 : 0;
  return (
    <div className="w-full">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Página {job.page}
        {job.totalPages ? ` de ${job.totalPages}` : ""} · {formatNumber(job.rows)} filas
      </p>
    </div>
  );
}

export function IngestPage() {
  const [types, setTypes] = useState<IngestTypeInfo[]>([]);
  const [options, setOptions] = useState<Options | null>(null);
  const [jobs, setJobs] = useState<IngestJob[]>([]);
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);
  const [selected, setSelected] = useState<IngestType[]>(["ventas_items", "ventas_totales", "compras_items", "compras_totales"]);
  const [sucursalId, setSucursalId] = useState<number | "">("");
  const [desde, setDesde] = useState(shiftPeriodo(currentPeriodo(), -2));
  const [hasta, setHasta] = useState(currentPeriodo());
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const loadJobs = useCallback(async () => {
    const [jobsData, coverageData] = await Promise.all([ingest.jobs(), ingest.coverage()]);
    setJobs(jobsData.items);
    setCoverage(coverageData.items);
  }, []);

  useEffect(() => {
    void (async () => {
      const [typesData, optionsData] = await Promise.all([ingest.types(), ingest.options()]);
      setTypes(typesData);
      setOptions(optionsData);
      if (optionsData.sucursales.length > 0) setSucursalId(optionsData.sucursales[0].sucursalId);
    })();
    void loadJobs();
  }, [loadJobs]);

  const active = jobs.some((job) => job.status === "queued" || job.status === "running");
  useEffect(() => {
    const interval = window.setInterval(() => void loadJobs(), active ? 3000 : 15000);
    return () => window.clearInterval(interval);
  }, [active, loadJobs]);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!sucursalId) return;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await ingest.create({ types: selected, sucursalId, desde, hasta });
      setFeedback({
        tone: "ok",
        text: result.items.length > 0 ? `${result.items.length} jobs en cola.` : "Esos períodos ya estaban en cola."
      });
      await loadJobs();
    } catch (error) {
      setFeedback({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function act(action: () => Promise<unknown>): Promise<void> {
    try {
      await action();
    } catch (error) {
      setFeedback({ tone: "error", text: errorMessage(error) });
    }
    await loadJobs();
  }

  const coverageMatrix = useMemo(() => {
    const periods = [...new Set(coverage.map((row) => row.periodo))].sort().reverse();
    const key = (type: string, sucursal: number, periodo: string) => `${type}|${sucursal}|${periodo}`;
    const map = new Map(coverage.map((row) => [key(row.type, row.sucursalId, row.periodo), row]));
    const sucursales = [...new Set(coverage.map((row) => row.sucursalId))];
    return { periods, sucursales, get: (type: string, sucursal: number, periodo: string) => map.get(key(type, sucursal, periodo)) };
  }, [coverage]);

  const sucursalName = (id: number): string =>
    options?.sucursales.find((s) => s.sucursalId === id)?.nombre ?? `Sucursal #${id}`;

  const enabledTypes = types.filter((t) => t.enabled);
  const preparedTypes = types.filter((t) => !t.enabled);
  const noSucursales = options !== null && options.sucursales.length === 0;

  return (
    <div className="space-y-4">
      <Card className="flex items-center gap-3 p-4">
        <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
          <DownloadCloud className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">Ingesta de datos</h1>
          <p className="text-sm text-muted-foreground">
            Importa ventas y compras de Ninox a la base local, mes por mes. Reimportar un mes reemplaza sus datos: nunca
            duplica.
          </p>
        </div>
      </Card>

      {noSucursales ? (
        <Card className="flex gap-3 border-amber-200 bg-amber-50/80 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            {options?.configFetchedAt ? (
              <p>
                La integración no tiene sucursales habilitadas para exportar: Ninox responde 403 hasta que el administrador
                las habilite en Configuración › Canales. Después, volvé a probar la conexión.
              </p>
            ) : (
              <p>
                Primero probá la conexión en{" "}
                <Link to="/configuracion" className="underline">
                  Configuración
                </Link>{" "}
                para leer las sucursales habilitadas.
              </p>
            )}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold">Nueva importación</h2>
          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Sucursal</label>
                <Select
                  value={sucursalId === "" ? "" : String(sucursalId)}
                  onChange={(e) => setSucursalId(e.target.value ? Number(e.target.value) : "")}
                  disabled={noSucursales}
                >
                  {options?.sucursales.map((s) => (
                    <option key={s.sucursalId} value={s.sucursalId}>
                      {s.nombre}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Desde</label>
                <Input type="month" value={desde} onChange={(e) => setDesde(e.target.value)} max={hasta} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Hasta</label>
                <Input type="month" value={hasta} onChange={(e) => setHasta(e.target.value)} min={desde} />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Datos</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {enabledTypes.map((type) => (
                  <label
                    key={type.type}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/70 bg-white/60 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="accent-[hsl(var(--primary))]"
                      checked={selected.includes(type.type)}
                      onChange={(e) =>
                        setSelected((prev) => (e.target.checked ? [...prev, type.type] : prev.filter((t) => t !== type.type)))
                      }
                    />
                    {type.label}
                  </label>
                ))}
                {preparedTypes.map((type) => (
                  <div
                    key={type.type}
                    className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground"
                  >
                    {type.label}
                    <Badge>Próximamente</Badge>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Se crea un job por mes y por tipo. Cada página trae hasta 500 filas y Ninox permite una página cada 30
              segundos en producción (3 s en testing), así que un mes grande puede tardar varios minutos.
            </p>

            <Button type="submit" disabled={busy || !sucursalId || selected.length === 0}>
              {busy ? "Encolando..." : "Importar"}
            </Button>
            {feedback ? (
              <p className={cn("rounded-xl px-3 py-2 text-sm", feedback.tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
                {feedback.text}
              </p>
            ) : null}
          </form>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Exportar CSV desde la base local</h2>
          <p className="text-sm text-muted-foreground">
            Descarga lo ya importado para el rango elegido ({formatPeriodo(desde)} a {formatPeriodo(hasta)}).
          </p>
          <div className="grid gap-2">
            {CSV_TABLES.map((item) => (
              <a
                key={item.table}
                href={ingest.csvUrl(item.table, desde, hasta, sucursalId || undefined)}
                className="flex items-center justify-between rounded-xl border border-border/70 bg-white/60 px-3 py-2 text-sm transition hover:border-primary/40"
              >
                {item.label}
                <FileDown className="h-4 w-4 text-muted-foreground" />
              </a>
            ))}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <h2 className="font-semibold">Cola de importación</h2>
          <Button variant="ghost" className="h-8 gap-1.5 px-3 text-xs" onClick={() => void loadJobs()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
        </div>
        {jobs.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sin importaciones todavía.</p> : null}
        <div className="divide-y divide-border/60">
          {jobs.slice(0, 50).map((job) => (
            <div key={job.id} className="grid items-center gap-3 px-4 py-3 text-sm md:grid-cols-[1.5fr_1fr_1.5fr_auto]">
              <div>
                <p className="font-medium">{job.label}</p>
                <p className="text-xs text-muted-foreground">
                  {job.periodo ? formatPeriodo(job.periodo) : "—"} · {job.sucursalId ? sucursalName(job.sucursalId) : "—"}
                </p>
              </div>
              <div>
                <Badge className={JOB_STATUS[job.status].className}>{JOB_STATUS[job.status].label}</Badge>
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(job.finishedAt ?? job.createdAt)}</p>
              </div>
              <div>
                <JobProgress job={job} />
                {job.error ? <p className="mt-1 text-xs text-red-600">{job.error}</p> : null}
              </div>
              <div className="flex gap-2">
                {job.status === "queued" || job.status === "running" ? (
                  <Button variant="ghost" className="h-8 px-3 text-xs" onClick={() => void act(() => ingest.cancel(job.id))}>
                    Cancelar
                  </Button>
                ) : null}
                {job.status === "failed" || job.status === "cancelled" ? (
                  <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => void act(() => ingest.retry(job.id))}>
                    Reintentar
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {coverageMatrix.periods.length > 0 ? (
        <Card className="overflow-x-auto">
          <h2 className="mb-3 text-lg font-semibold">Cobertura importada</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Período</th>
                <th className="pb-2 pr-4 font-medium">Sucursal</th>
                {enabledTypes.map((type) => (
                  <th key={type.type} className="pb-2 pr-4 font-medium">
                    {type.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {coverageMatrix.periods.flatMap((periodo) =>
                coverageMatrix.sucursales.map((sucursal) => (
                  <tr key={`${periodo}-${sucursal}`}>
                    <td className="py-2 pr-4 font-medium">{formatPeriodo(periodo)}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{sucursalName(sucursal)}</td>
                    {enabledTypes.map((type) => {
                      const cell = coverageMatrix.get(type.type, sucursal, periodo);
                      return (
                        <td key={type.type} className="py-2 pr-4">
                          {cell ? (
                            <span title={`Importado ${formatDateTime(cell.importedAt)}`} className="text-emerald-700">
                              ✓ {formatNumber(cell.rows)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}
