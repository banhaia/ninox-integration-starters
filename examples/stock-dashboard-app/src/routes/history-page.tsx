import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ClipboardList, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { getPreventaHistory } from "@/lib/api";
import type { HistoryEntry } from "@/lib/api";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function EntryRow({ entry }: { entry: HistoryEntry }): JSX.Element {
  const [open, setOpen] = useState(false);

  const result = entry.result;
  const payload = entry.payload;

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <span className="text-muted-foreground">
          {open
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
        </span>

        <Badge
          className={cn(
            "shrink-0 text-xs",
            entry.type === "preventa"
              ? "bg-blue-100 text-blue-700"
              : "bg-emerald-100 text-emerald-700"
          )}
        >
          {entry.type}
        </Badge>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-medium text-sm">
              {payload.usuario?.nombre ?? "—"}
            </span>
            <span className="text-xs text-muted-foreground">
              OrdenId: {payload.ordenId}
            </span>
            {result.facturaId ? (
              <span className="text-xs text-muted-foreground">
                FacturaId: <span className="font-semibold text-foreground">{result.facturaId}</span>
              </span>
            ) : null}
            {result.sref ? (
              <span className="text-xs text-muted-foreground">
                Ref: {result.sref}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs text-muted-foreground">
              {formatDate(entry.timestamp)}
            </span>
            <span className="text-xs tabular-nums font-medium">
              Total: ${payload.total?.toFixed(2) ?? "—"}
            </span>
            <span className="text-xs text-muted-foreground">
              {payload.productos?.length ?? 0} artículo{(payload.productos?.length ?? 0) !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-3 px-4 pb-4 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Payload enviado
            </p>
            <pre className="max-h-72 overflow-auto rounded-xl bg-muted/60 p-3 text-xs leading-relaxed">
              {JSON.stringify(entry.payload, null, 2)}
            </pre>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Respuesta Ninox
            </p>
            <pre className="max-h-72 overflow-auto rounded-xl bg-muted/60 p-3 text-xs leading-relaxed">
              {JSON.stringify(entry.result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export function HistoryPage(): JSX.Element {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load(): void {
    setLoading(true);
    setError(null);
    getPreventaHistory()
      .then((data) => setEntries([...data].reverse()))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Historial</h1>
            <p className="text-sm text-muted-foreground">
              Preventas y ventas enviadas exitosamente a Ninox
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-8 gap-1.5 px-3 text-xs"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Actualizar
        </Button>
      </Card>

      <Card className="overflow-hidden p-0">
        {loading && (
          <p className="py-10 text-center text-sm text-muted-foreground">Cargando historial...</p>
        )}
        {error && (
          <p className="py-10 text-center text-sm text-red-500">{error}</p>
        )}
        {!loading && !error && entries.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Todavía no hay registros. Los envíos exitosos aparecen acá automáticamente.
          </p>
        )}
        {!loading && !error && entries.length > 0 && (
          <div>
            {entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
