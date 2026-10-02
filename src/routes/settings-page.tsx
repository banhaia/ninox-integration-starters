import { useCallback, useEffect, useState, type FormEvent } from "react";
import { KeyRound, PlugZap, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { auth, errorMessage, settings, type NinoxEnv, type SettingsPayload } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

const ENV_LABEL: Record<NinoxEnv, string> = {
  test: "Testing (api.test-ninox.com.ar)",
  prod: "Producción (api.ninox.com.ar)",
  custom: "URL personalizada (API local o staging)"
};

const BUCKET_LABEL: Record<string, string> = {
  masivo: "Catálogo y exportaciones masivas",
  comprobantePaginado: "Exportaciones paginadas de comprobantes",
  saldos: "Saldos",
  parametros: "Configuración y parámetros",
  comprobante: "Consulta de comprobante",
  entidades: "Clientes"
};

function Feedback({ tone, text }: { tone: "ok" | "error"; text: string }) {
  return (
    <p className={tone === "ok" ? "rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700" : "rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"}>
      {text}
    </p>
  );
}

function NinoxConnectionCard({ data, onSaved }: { data: SettingsPayload; onSaved: () => Promise<void> }) {
  const [env, setEnv] = useState<NinoxEnv>(data.ninox.env);
  const [baseUrl, setBaseUrl] = useState(data.ninox.env === "custom" ? data.ninox.baseUrl : "");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const envLocked = data.ninox.source.env === "env";
  const tokenLocked = data.ninox.source.token === "env";

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await settings.saveNinox({
        env: envLocked ? undefined : env,
        baseUrl: env === "custom" ? baseUrl : undefined,
        token: token.trim() || undefined
      });
      setToken("");
      const result = await settings.testNinox();
      setFeedback({ tone: "ok", text: `Conexión correcta con la integración "${result.ninoxConfig.config.nombre}".` });
    } catch (error) {
      setFeedback({ tone: "error", text: errorMessage(error) });
    } finally {
      await onSaved();
      setBusy(false);
    }
  }

  async function test(): Promise<void> {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await settings.testNinox();
      setFeedback({ tone: "ok", text: `Conexión correcta con la integración "${result.ninoxConfig.config.nombre}".` });
    } catch (error) {
      setFeedback({ tone: "error", text: errorMessage(error) });
    } finally {
      await onSaved();
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary">
          <PlugZap className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Conexión con Ninox</h2>
          <p className="text-sm text-muted-foreground">
            El token se guarda en la base local del servidor y nunca se envía al navegador.
          </p>
        </div>
      </div>

      <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => void save(event)}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Entorno</label>
          <Select value={env} onChange={(e) => setEnv(e.target.value as NinoxEnv)} disabled={envLocked}>
            {(Object.keys(ENV_LABEL) as NinoxEnv[]).map((key) => (
              <option key={key} value={key}>
                {ENV_LABEL[key]}
              </option>
            ))}
          </Select>
          {envLocked ? <p className="text-xs text-muted-foreground">Definido por NINOX_ENV en .env</p> : null}
        </div>

        {env === "custom" ? (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">URL base</label>
            <Input
              placeholder="http://localhost:5000"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              disabled={data.ninox.source.baseUrl === "env"}
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">URL base</label>
            <Input value={env === "prod" ? "https://api.ninox.com.ar" : "https://api.test-ninox.com.ar"} disabled readOnly />
          </div>
        )}

        <div className="space-y-1.5 md:col-span-2">
          <label className="text-sm font-medium">Token X-NX-TOKEN</label>
          <Input
            type="password"
            autoComplete="off"
            placeholder={
              data.ninox.hasToken ? `Configurado (termina en …${data.ninox.tokenLast4}). Dejalo vacío para mantenerlo.` : "Pegá el token de la integración"
            }
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={tokenLocked}
          />
          {tokenLocked ? <p className="text-xs text-muted-foreground">Definido por NINOX_TOKEN en .env</p> : null}
          <p className="text-xs text-muted-foreground">
            ¿No tenés token? Pedilo en{" "}
            <a className="underline" href="https://www.ninoxnet.com/integraciones/terceros" target="_blank" rel="noreferrer">
              ninoxnet.com/integraciones/terceros
            </a>
            .
          </p>
        </div>

        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Guardando..." : "Guardar y probar"}
          </Button>
          <Button type="button" variant="secondary" disabled={busy || !data.ninox.hasToken} onClick={() => void test()}>
            Probar conexión
          </Button>
        </div>
      </form>

      {feedback ? <Feedback tone={feedback.tone} text={feedback.text} /> : null}

      {data.ninoxConfig ? (
        <div className="space-y-3 rounded-2xl border border-border/70 bg-white/60 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">Integración: {data.ninoxConfig.config.nombre}</p>
            <span className="text-xs text-muted-foreground">Leída {formatDateTime(data.ninoxConfig.fetchedAt)}</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Punto de venta</p>
              <p className="font-medium">{data.ninoxConfig.config.puntoVentaId}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Lista de precios</p>
              <p className="font-medium">{data.ninoxConfig.config.listaPrecioId}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Multidepósito</p>
              <p className="font-medium">{data.ninoxConfig.config.multiDeposito ? "Sí" : "No"}</p>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Sucursales habilitadas para exportar</p>
            {data.ninoxConfig.config.sucursalesExportacion.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.ninoxConfig.config.sucursalesExportacion.map((s) => (
                  <Badge key={s.sucursalId}>
                    {s.nombre} · #{s.sucursalId}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-amber-700">
                Ninguna. Las exportaciones van a responder 403 hasta que el administrador habilite sucursales en
                Configuración › Canales de Ninox.
              </p>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Depósitos</p>
            <div className="flex flex-wrap gap-2">
              {data.ninoxConfig.config.depositos.map((d) => (
                <Badge key={d.depositoId} className={d.default ? "bg-primary/10 text-primary" : undefined}>
                  {d.nombre} · #{d.depositoId}
                  {d.default ? " (principal)" : ""}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function RateLimitsCard({ data }: { data: SettingsPayload }) {
  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">Límites de consulta</h2>
      <p className="text-sm text-muted-foreground">
        Ninox limita la frecuencia por grupo de endpoints. La app respeta estas ventanas y las guarda en la base para
        que un reinicio no provoque errores 403.
      </p>
      <div className="divide-y divide-border/60 text-sm">
        {data.rateLimits.map((limit) => (
          <div key={limit.bucket} className="flex items-center justify-between py-2">
            <span>{BUCKET_LABEL[limit.bucket] ?? limit.bucket}</span>
            <span className="text-muted-foreground">
              1 cada {limit.windowSeconds}s
              {limit.remainingSeconds > 0 ? ` · libre en ${limit.remainingSeconds}s` : " · disponible"}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function OrdersSettingsCard({ data, onSaved }: { data: SettingsPayload; onSaved: () => Promise<void> }) {
  const [value, setValue] = useState(String(data.ninox.ordenIdBase));
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    try {
      await settings.saveOrders(Number(value));
      setFeedback({ tone: "ok", text: "Guardado" });
      await onSaved();
    } catch (error) {
      setFeedback({ tone: "error", text: errorMessage(error) });
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">Numeración de pedidos</h2>
      <p className="text-sm text-muted-foreground">
        Cada reserva o venta viaja con un ordenId único. Si otra app usa el mismo token, definí un número inicial que no
        se superponga (por ejemplo 100000).
      </p>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => void save(event)}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">ordenId inicial</label>
          <Input type="number" min={1} value={value} onChange={(e) => setValue(e.target.value)} className="w-48" />
        </div>
        <Button type="submit" variant="secondary">
          Guardar
        </Button>
      </form>
      {feedback ? <Feedback tone={feedback.tone} text={feedback.text} /> : null}
    </Card>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (next.length < 6) {
      setFeedback({ tone: "error", text: "La nueva contraseña debe tener al menos 6 caracteres" });
      return;
    }
    try {
      await auth.changePassword(current, next);
      setCurrent("");
      setNext("");
      setFeedback({ tone: "ok", text: "Contraseña actualizada. Se cerraron las demás sesiones." });
    } catch (error) {
      setFeedback({ tone: "error", text: errorMessage(error) });
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold">Cambiar contraseña</h2>
      </div>
      <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end" onSubmit={(event) => void save(event)}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Actual</label>
          <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Nueva (mínimo 6)</label>
          <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <Button type="submit" variant="secondary">
          Cambiar
        </Button>
      </form>
      {feedback ? <Feedback tone={feedback.tone} text={feedback.text} /> : null}
    </Card>
  );
}

export function SettingsPage() {
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await settings.get());
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <Card className="text-red-700">{error}</Card>;
  if (!data) return <div className="py-16 text-center text-muted-foreground">Cargando...</div>;

  return (
    <div className="space-y-4">
      <Card className="flex items-center gap-3 p-4">
        <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">Configuración</h1>
          <p className="text-sm text-muted-foreground">Conexión con Ninox, numeración de pedidos y acceso.</p>
        </div>
      </Card>
      <NinoxConnectionCard data={data} onSaved={load} />
      <div className="grid gap-4 lg:grid-cols-2">
        <RateLimitsCard data={data} />
        <div className="space-y-4">
          <OrdersSettingsCard data={data} onSaved={load} />
          <PasswordCard />
        </div>
      </div>
    </div>
  );
}
