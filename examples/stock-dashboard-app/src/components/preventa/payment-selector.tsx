import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { TIPO_MEDIO, TIPO_MEDIO_LABELS } from "@/lib/preventa-types";
import type { MediosPagoPayload } from "@/lib/api";
import type { FormMedioPago } from "@/lib/preventa-types";

interface PaymentSelectorProps {
  mediosPago: MediosPagoPayload | null;
  loading: boolean;
  loadError: string | null;
  value: FormMedioPago;
  errors: Record<string, string>;
  onChange: (patch: FormMedioPago) => void;
  onRetry: () => void;
}

type MedioKey = "efectivo" | "tarjeta" | "cuentaCorriente" | "deposito" | "virtual";

const MEDIOS_MAP: { key: MedioKey; tipo: number; label: string }[] = [
  { key: "efectivo", tipo: TIPO_MEDIO.EFECTIVO, label: TIPO_MEDIO_LABELS[TIPO_MEDIO.EFECTIVO] },
  { key: "tarjeta", tipo: TIPO_MEDIO.TARJETA, label: TIPO_MEDIO_LABELS[TIPO_MEDIO.TARJETA] },
  { key: "cuentaCorriente", tipo: TIPO_MEDIO.CUENTA_CORRIENTE, label: TIPO_MEDIO_LABELS[TIPO_MEDIO.CUENTA_CORRIENTE] },
  { key: "deposito", tipo: TIPO_MEDIO.DEPOSITO_BANCO, label: TIPO_MEDIO_LABELS[TIPO_MEDIO.DEPOSITO_BANCO] },
  { key: "virtual", tipo: TIPO_MEDIO.VIRTUAL, label: TIPO_MEDIO_LABELS[TIPO_MEDIO.VIRTUAL] }
];

export function PaymentSelector({
  mediosPago,
  loading,
  loadError,
  value,
  errors,
  onChange,
  onRetry
}: PaymentSelectorProps): JSX.Element {
  if (loading) {
    return (
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Medio de pago
        </h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando medios de pago...
        </div>
      </Card>
    );
  }

  if (!mediosPago) {
    return (
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Medio de pago
        </h2>
        <div className="flex items-center gap-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <span className="text-muted-foreground">
            {loadError ?? "No se pudieron cargar los medios de pago."}
          </span>
          <Button
            type="button"
            variant="ghost"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={onRetry}
          >
            <RefreshCw className="h-3 w-3" />
            Reintentar
          </Button>
        </div>
        {errors.MedioPago && (
          <p className="mt-2 text-xs text-red-500">{errors.MedioPago}</p>
        )}
      </Card>
    );
  }

  const medios = mediosPago.medios;
  const enabledTipos = MEDIOS_MAP.filter((m) => medios[m.key]);

  const matchingRules =
    value.tipo === TIPO_MEDIO.TARJETA && value.tarjetaId
      ? mediosPago.tarjetasReglas.filter((r) => r.tarjetaId === value.tarjetaId && r.activo)
      : [];

  return (
    <Card className="p-4 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Medio de pago
      </h2>

      <div className="flex flex-wrap gap-2">
        {enabledTipos.map((m) => (
          <Button
            key={m.tipo}
            type="button"
            variant="ghost"
            onClick={() => onChange({ tipo: m.tipo })}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium border transition",
              value.tipo === m.tipo
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {m.label}
          </Button>
        ))}
      </div>

      {errors.MedioPago && (
        <p className="text-xs text-red-500">{errors.MedioPago}</p>
      )}

      {value.tipo === TIPO_MEDIO.TARJETA && (
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">Tarjeta <span className="text-red-500">*</span></label>
            <Select
              value={value.tarjetaId ? String(value.tarjetaId) : ""}
              onChange={(e) =>
                onChange({ ...value, tarjetaId: e.target.value ? Number(e.target.value) : undefined })
              }
              className={errors["MedioPago.TarjetaId"] ? "border-red-400" : ""}
            >
              <option value="">Seleccionar tarjeta...</option>
              {mediosPago.tarjetas.map((t) => (
                <option key={t.tarjetaId} value={t.tarjetaId}>
                  {t.nombre}
                  {t.banco ? ` — ${t.banco.nombre}` : ""}
                </option>
              ))}
            </Select>
            {errors["MedioPago.TarjetaId"] && (
              <p className="text-xs text-red-500">{errors["MedioPago.TarjetaId"]}</p>
            )}
          </div>
          {matchingRules.length > 0 && (
            <div className="rounded-xl bg-muted/50 px-3 py-2 text-xs space-y-1">
              <p className="font-medium text-muted-foreground">Planes disponibles:</p>
              {matchingRules.map((r) => (
                <p key={r.tarjetaReglaId} className="text-muted-foreground">
                  {r.cuotas} cuotas · {r.porcentaje}%{r.recargo ? " recargo" : " descuento"}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {value.tipo === TIPO_MEDIO.DEPOSITO_BANCO && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Cuenta bancaria <span className="text-red-500">*</span></label>
          <Select
            value={value.cuentaBancariaId ? String(value.cuentaBancariaId) : ""}
            onChange={(e) =>
              onChange({ ...value, cuentaBancariaId: e.target.value ? Number(e.target.value) : undefined })
            }
            className={errors["MedioPago.CuentaBancariaId"] ? "border-red-400" : ""}
          >
            <option value="">Seleccionar cuenta...</option>
            {mediosPago.cuentasBancarias.map((c) => (
              <option key={c.cuentaBancariaId} value={c.cuentaBancariaId}>
                {c.descripcion}
                {c.banco ? ` — ${c.banco.nombre}` : ""}
                {` (nro. ${c.numero})`}
              </option>
            ))}
          </Select>
          {errors["MedioPago.CuentaBancariaId"] && (
            <p className="text-xs text-red-500">{errors["MedioPago.CuentaBancariaId"]}</p>
          )}
        </div>
      )}

      {value.tipo === TIPO_MEDIO.VIRTUAL && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">External ID <span className="text-red-500">*</span></label>
          <Input
            placeholder="ID del pago virtual"
            value={value.externalId ?? ""}
            onChange={(e) => onChange({ ...value, externalId: e.target.value })}
            className={errors["MedioPago.ExternalId"] ? "border-red-400" : ""}
          />
          {errors["MedioPago.ExternalId"] && (
            <p className="text-xs text-red-500">{errors["MedioPago.ExternalId"]}</p>
          )}
        </div>
      )}
    </Card>
  );
}
