import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface OrderHeaderProps {
  ordenId: string;
  numero: string;
  detalle: string;
  errors: Record<string, string>;
  onChange: (field: "ordenId" | "numero" | "detalle", value: string) => void;
}

export function OrderHeader({ ordenId, numero, detalle, errors, onChange }: OrderHeaderProps): JSX.Element {
  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Identificadores del pedido
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">OrdenId <span className="text-red-500">*</span></label>
          <Input
            type="number"
            placeholder="ID externo del pedido"
            value={ordenId}
            onChange={(e) => onChange("ordenId", e.target.value)}
            className={errors.OrdenId ? "border-red-400" : ""}
          />
          {errors.OrdenId && <p className="text-xs text-red-500">{errors.OrdenId}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Número <span className="text-red-500">*</span></label>
          <Input
            type="number"
            placeholder="Número del comprobante"
            value={numero}
            onChange={(e) => onChange("numero", e.target.value)}
            className={errors.Numero ? "border-red-400" : ""}
          />
          {errors.Numero && <p className="text-xs text-red-500">{errors.Numero}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Detalle / Nota</label>
          <Input
            placeholder="Nota interna (opcional)"
            value={detalle}
            onChange={(e) => onChange("detalle", e.target.value)}
          />
        </div>
      </div>
    </Card>
  );
}
