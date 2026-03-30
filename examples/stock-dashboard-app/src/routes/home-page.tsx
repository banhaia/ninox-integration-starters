import { useEffect, useState } from "react";
import { CircleAlert, Layers3, ScanSearch, Warehouse } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { StatusBanner } from "@/components/status-banner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getDashboard, triggerSync, type DashboardPayload } from "@/lib/api";

export function HomePage(): JSX.Element {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const payload = await getDashboard();
      setData(payload);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync(): Promise<void> {
    setSyncing(true);
    try {
      await triggerSync();
    } catch {
      // The status endpoint already exposes configuration and sync errors.
    } finally {
      await load();
      setSyncing(false);
    }
  }

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(interval);
  }, []);

  if (loading && !data) {
    return <div className="py-16 text-center text-muted-foreground">Cargando estado del dashboard...</div>;
  }

  if (!data) {
    return <div className="py-16 text-center text-muted-foreground">No se pudo cargar el dashboard.</div>;
  }

  return (
    <div className="space-y-6">
      <StatusBanner status={data.status} onSync={handleSync} syncing={syncing} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon="products"
          label="Articulos"
          value={String(data.summary.totalProducts)}
          hint={data.summary.hasData ? "productos persistidos en cache local" : "sin snapshot cargado"}
          tone="accent"
        />
        <KpiCard
          icon="stock"
          label="Stock total"
          value={String(data.summary.totalStock)}
          hint={`${data.summary.outOfStockProducts} productos sin stock`}
        />
        <KpiCard
          icon="colors"
          label="Colores detectados"
          value={String(data.summary.availableColors)}
          hint="faceta derivada desde variantes/datos crudos"
        />
        <KpiCard
          icon="sizes"
          label="Talles detectados"
          value={String(data.summary.availableSizes)}
          hint={`${data.summary.totalVariants} variantes analizadas`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-accent/15 p-3 text-accent">
              <Warehouse className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Cobertura local</h2>
              <p className="text-sm text-muted-foreground">
                Toda la UI trabaja sobre el snapshot persistido. El sync solo refresca el cache.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge>{data.summary.hasData ? "Hay datos listos para consultar" : "Sin datos locales"}</Badge>
            <Badge>{data.status.hasConfiguredSources ? "Source Ninox disponible" : "Source Ninox no configurado"}</Badge>
            <Badge>{data.summary.totalVariants} variantes</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-secondary/50 p-4">
              <p className="text-sm text-muted-foreground">Snapshot</p>
              <p className="mt-2 text-2xl font-semibold">{data.summary.hasData ? "Activo" : "Vacio"}</p>
            </div>
            <div className="rounded-2xl bg-secondary/50 p-4">
              <p className="text-sm text-muted-foreground">Colores</p>
              <p className="mt-2 text-2xl font-semibold">{data.facets.colors.length}</p>
            </div>
            <div className="rounded-2xl bg-secondary/50 p-4">
              <p className="text-sm text-muted-foreground">Talles</p>
              <p className="mt-2 text-2xl font-semibold">{data.facets.sizes.length}</p>
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <Layers3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Arquitectura lista para crecer</h2>
              <p className="text-sm text-muted-foreground">
                Separa fuentes, persistencia local y vistas para sumar otros origenes.
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-muted-foreground">
            <p>1. Ninox descarga el JSON completo y lo normaliza.</p>
            <p>2. El backend guarda un snapshot local en disco.</p>
            <p>3. La UI consulta solo la API local.</p>
            <p>4. Queda espacio para anexar sources futuros, por ejemplo planillas o pedidos.</p>
          </div>

          {!data.summary.hasData ? (
            <div className="rounded-2xl border border-dashed border-border bg-white/60 p-4 text-sm text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <CircleAlert className="h-4 w-4 text-accent" />
                No hay snapshot todavia
              </div>
              Ejecuta un sync manual cuando el token Ninox este configurado.
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-white/60 p-4 text-sm text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <ScanSearch className="h-4 w-4 text-primary" />
                Snapshot disponible
              </div>
              El listado ya puede responder filtros y busquedas sin volver a pegarle a Ninox en cada request.
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
