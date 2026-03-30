import { AlertTriangle, CheckCircle2, LoaderCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SyncStatus } from "@/lib/api";

interface StatusBannerProps {
  status: SyncStatus;
  onSync: () => Promise<void>;
  syncing: boolean;
}

export function StatusBanner({
  status,
  onSync,
  syncing
}: StatusBannerProps): JSX.Element {
  const ready = status.lastSyncAt && !status.syncError;

  return (
    <Card className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          {syncing || status.syncInProgress ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : ready ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <AlertTriangle className="h-5 w-5" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Estado del snapshot
          </p>
          <p className="mt-1 text-lg font-semibold">
            {status.lastSyncAt
              ? `Ultima sincronizacion: ${new Date(status.lastSyncAt).toLocaleString()}`
              : "Todavia no hay sincronizacion guardada"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {status.hasConfiguredSources
              ? `Sources configurados: ${status.configuredSourceIds.join(", ")}`
              : "No hay source Ninox configurado. Completá el token para habilitar la descarga."}
          </p>
          {status.syncError ? (
            <p className="mt-2 text-sm text-red-600">{status.syncError}</p>
          ) : null}
        </div>
      </div>

      <Button className="gap-2 self-start md:self-auto" onClick={() => void onSync()} disabled={syncing || status.syncInProgress}>
        <RefreshCcw className={syncing || status.syncInProgress ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        Sync ahora
      </Button>
    </Card>
  );
}
