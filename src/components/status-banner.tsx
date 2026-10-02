import { AlertTriangle, CheckCircle2, LoaderCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SyncStatus } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

interface StatusBannerProps {
  status: SyncStatus;
  onSync: () => Promise<void>;
  syncing: boolean;
  message?: string | null;
}

export function StatusBanner({ status, onSync, syncing, message }: StatusBannerProps) {
  const busy = syncing || status.syncInProgress;
  const ready = Boolean(status.lastSyncAt) && status.lastRunStatus !== "error";
  const waiting = status.nextAllowedInSeconds > 0;

  return (
    <Card className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          {busy ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : ready ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <AlertTriangle className="h-5 w-5" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Catálogo</p>
          <p className="mt-1 text-lg font-semibold">
            {status.lastSyncAt
              ? `Última sincronización: ${formatDateTime(status.lastSyncAt)}`
              : "Todavía no hay sincronización"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {status.configured
              ? `Se actualiza solo cada ${status.intervalMinutes} minutos (Ninox permite una consulta cada 10 min en producción).`
              : "Falta configurar el token de Ninox en Configuración."}
          </p>
          {status.lastError ? <p className="mt-2 text-sm text-red-600">{status.lastError}</p> : null}
          {message ? <p className="mt-2 text-sm text-amber-700">{message}</p> : null}
        </div>
      </div>

      <Button
        className="gap-2 self-start md:self-auto"
        onClick={() => void onSync()}
        disabled={busy || !status.configured || waiting}
        title={waiting ? `Disponible en ${status.nextAllowedInSeconds}s` : undefined}
      >
        <RefreshCcw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        {waiting ? `Sync en ${status.nextAllowedInSeconds}s` : "Sincronizar ahora"}
      </Button>
    </Card>
  );
}
