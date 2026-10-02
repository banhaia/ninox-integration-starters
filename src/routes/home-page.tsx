import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { StatusBanner } from "@/components/status-banner";
import { Card } from "@/components/ui/card";
import { getDashboard, ingest, settings, triggerSync, errorMessage, type DashboardPayload } from "@/lib/api";
import { formatNumber } from "@/lib/format";

interface Checklist {
  token: boolean;
  config: boolean;
  catalog: boolean;
  ingest: boolean;
}

function Step({ done, title, detail, to }: { done: boolean; title: string; detail: string; to: string }) {
  return (
    <Link
      to={to}
      className="flex items-start gap-3 rounded-2xl border border-border/70 bg-white/60 p-4 transition hover:border-primary/40"
    >
      {done ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      ) : (
        <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
      )}
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
      <ArrowRight className="mt-0.5 h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

export function HomePage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [dashboard, config, coverage] = await Promise.all([getDashboard(), settings.get(), ingest.coverage()]);
    setData(dashboard);
    setChecklist({
      token: config.ninox.hasToken,
      config: Boolean(config.ninoxConfig),
      catalog: dashboard.summary.hasData,
      ingest: coverage.items.length > 0
    });
  }, []);

  async function handleSync(): Promise<void> {
    setSyncing(true);
    setMessage(null);
    try {
      await triggerSync();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      await load();
      setSyncing(false);
    }
  }

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(interval);
  }, [load]);

  if (!data || !checklist) {
    return <div className="py-16 text-center text-muted-foreground">Cargando...</div>;
  }

  const pending = Object.values(checklist).filter((done) => !done).length;

  return (
    <div className="space-y-6">
      {pending > 0 ? (
        <Card className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Primeros pasos</h2>
            <p className="text-sm text-muted-foreground">Te faltan {pending} pasos para tener la integración completa.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Step
              done={checklist.token}
              title="1. Cargar el token de Ninox"
              detail="Token X-NX-TOKEN de la integración de terceros y entorno (test o producción)."
              to="/configuracion"
            />
            <Step
              done={checklist.config}
              title="2. Probar la conexión"
              detail="Descarga la configuración: sucursales habilitadas, depósitos, punto de venta."
              to="/configuracion"
            />
            <Step
              done={checklist.catalog}
              title="3. Sincronizar el catálogo"
              detail="Artículos, variantes, precios y stock quedan en la base local."
              to="/stock"
            />
            <Step
              done={checklist.ingest}
              title="4. Ingestar ventas y compras"
              detail="Importá meses completos para habilitar los reportes."
              to="/ingesta"
            />
          </div>
        </Card>
      ) : null}

      <StatusBanner status={data.status} onSync={handleSync} syncing={syncing} message={message} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon="products"
          label="Artículos"
          value={formatNumber(data.summary.totalProducts)}
          hint={data.summary.hasData ? "activos en la base local" : "sin catálogo sincronizado"}
          tone="accent"
        />
        <KpiCard
          icon="stock"
          label="Stock total"
          value={formatNumber(data.summary.totalStock)}
          hint={`${formatNumber(data.summary.outOfStockProducts)} artículos sin stock`}
        />
        <KpiCard
          icon="colors"
          label="Colores"
          value={formatNumber(data.summary.availableColors)}
          hint="detectados en las variantes"
        />
        <KpiCard
          icon="sizes"
          label="Talles"
          value={formatNumber(data.summary.availableSizes)}
          hint={`${formatNumber(data.summary.totalVariants)} variantes`}
        />
      </section>
    </div>
  );
}
