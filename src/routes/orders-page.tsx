import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ClipboardList, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { errorMessage, orders, type OrderKind, type OrderRecord, type OrderStatus } from "@/lib/api";
import { formatDateTime, formatMoneyCents } from "@/lib/format";

const STATUS_LABEL: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: "Enviando", className: "bg-sky-100 text-sky-700" },
  created: { label: "Creada", className: "bg-emerald-100 text-emerald-700" },
  failed: { label: "Rechazada", className: "bg-red-100 text-red-700" },
  unknown: { label: "Sin confirmar", className: "bg-amber-100 text-amber-800" },
  cancelled: { label: "Cancelada", className: "bg-zinc-200 text-zinc-700" }
};

function Json({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <pre className="max-h-72 overflow-auto rounded-xl bg-muted/60 p-3 text-xs leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function OrderRow({ order, onChanged }: { order: OrderRecord; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [comprobante, setComprobante] = useState<unknown>(null);
  const status = STATUS_LABEL[order.status];

  async function run(action: () => Promise<unknown>, after?: (result: unknown) => void): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const result = await action();
      after?.(result);
      onChanged();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <span className="text-muted-foreground">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
        <Badge className={cn("shrink-0", order.kind === "preventa" ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700")}>
          {order.kind === "preventa" ? "reserva" : "venta"}
        </Badge>
        <Badge className={cn("shrink-0", status.className)}>{status.label}</Badge>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">{order.clienteNombre ?? "—"}</span>
            <span className="text-xs text-muted-foreground">OrdenId {order.ordenId}</span>
            {order.facturaId ? <span className="text-xs text-muted-foreground">FacturaId {order.facturaId}</span> : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{formatDateTime(order.createdAt)}</span>
            <span className="font-medium tabular-nums text-foreground">{formatMoneyCents(order.total)}</span>
            {order.error ? <span className="truncate text-red-600">{order.error}</span> : null}
          </div>
        </div>
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {order.kind === "preventa" && order.status === "created" ? (
              <Button
                variant="secondary"
                className="h-8 px-3 text-xs"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`¿Cancelar la reserva ${order.ordenId} en Ninox?`)) void run(() => orders.cancel(order.id));
                }}
              >
                Cancelar reserva
              </Button>
            ) : null}
            {order.status === "failed" || order.status === "unknown" ? (
              <Button variant="secondary" className="h-8 px-3 text-xs" disabled={busy} onClick={() => void run(() => orders.retry(order.id))}>
                Reintentar (mismo ordenId)
              </Button>
            ) : null}
            {order.facturaId ? (
              <Button
                variant="ghost"
                className="h-8 px-3 text-xs"
                disabled={busy}
                onClick={() => void run(() => orders.comprobante(order.id), setComprobante)}
              >
                Consultar comprobante en Ninox
              </Button>
            ) : null}
          </div>
          {message ? <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{message}</p> : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Json title="Payload enviado" value={order.payload} />
            <Json title="Respuesta de Ninox" value={order.response} />
          </div>
          {comprobante ? <Json title="Comprobante actual (GET comprobante/{id})" value={comprobante} /> : null}
        </div>
      )}
    </div>
  );
}

export function OrdersPage() {
  const [items, setItems] = useState<OrderRecord[]>([]);
  const [kind, setKind] = useState<OrderKind | "">("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    orders
      .list({ kind: kind || undefined, status: status || undefined })
      .then((data) => setItems(data.items))
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [kind, status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Reservas y ventas</h1>
            <p className="text-sm text-muted-foreground">Operaciones enviadas a Ninox desde esta app.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select className="h-9 w-40" value={kind} onChange={(e) => setKind(e.target.value as OrderKind | "")}>
            <option value="">Todas</option>
            <option value="preventa">Reservas</option>
            <option value="venta">Ventas</option>
          </Select>
          <Select className="h-9 w-44" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | "")}>
            <option value="">Todos los estados</option>
            {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((key) => (
              <option key={key} value={key}>
                {STATUS_LABEL[key].label}
              </option>
            ))}
          </Select>
          <Button type="button" variant="ghost" className="h-9 gap-1.5 px-3 text-xs" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Actualizar
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {error ? <p className="py-10 text-center text-sm text-red-600">{error}</p> : null}
        {!error && !loading && items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Todavía no hay operaciones registradas.</p>
        ) : null}
        {items.map((order) => (
          <OrderRow key={order.id} order={order} onChanged={load} />
        ))}
      </Card>
    </div>
  );
}
