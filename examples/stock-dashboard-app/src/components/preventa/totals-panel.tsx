import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface TotalsPanelProps {
  subtotal: number;
  descuento: number;
  recargo: number;
  envioMonto: number;
  total: number;
  onChangeDescuento: (v: number) => void;
  onChangeRecargo: (v: number) => void;
  onChangeEnvio: (v: number) => void;
}

function NumericInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={value === 0 ? "" : value}
        placeholder="0.00"
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-7 w-32 text-right text-sm tabular-nums"
      />
    </div>
  );
}

export function TotalsPanel({
  subtotal,
  descuento,
  recargo,
  envioMonto,
  total,
  onChangeDescuento,
  onChangeRecargo,
  onChangeEnvio
}: TotalsPanelProps): JSX.Element {
  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Totales
      </h2>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Subtotal</span>
          <span className="tabular-nums text-sm">${subtotal.toFixed(2)}</span>
        </div>
        <NumericInput label="Descuento" value={descuento} onChange={onChangeDescuento} />
        <NumericInput label="Recargo" value={recargo} onChange={onChangeRecargo} />
        <NumericInput label="Envío" value={envioMonto} onChange={onChangeEnvio} />
        <div className="border-t border-border/60 pt-2 flex items-center justify-between">
          <span className="font-semibold">Total</span>
          <div className="flex items-center gap-2">
            {total <= 0 && (
              <AlertTriangle className="h-4 w-4 text-amber-500" title="Total debe ser mayor a 0" />
            )}
            <span className="text-lg font-bold tabular-nums">${total.toFixed(2)}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-right">
          Subtotal + Envío + Recargo − Descuento
        </p>
      </div>
    </Card>
  );
}
