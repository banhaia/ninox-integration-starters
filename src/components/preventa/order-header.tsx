import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface OrderHeaderProps {
  nextOrdenId: number | null;
  entidadId: string;
  detalle: string;
  onChange: (field: "entidadId" | "detalle", value: string) => void;
}

export function OrderHeader({ nextOrdenId, entidadId, detalle, onChange }: OrderHeaderProps) {
  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Datos del pedido</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">OrdenId</label>
          <Input value={nextOrdenId ?? "…"} readOnly disabled />
          <p className="text-xs text-muted-foreground">
            Lo asigna la app. Es la clave de idempotencia: un reintento reutiliza el mismo número.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Cliente existente (entidadId)</label>
          <Input
            type="number"
            placeholder="Opcional"
            value={entidadId}
            onChange={(e) => onChange("entidadId", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Si lo completás, Ninox usa ese cliente y los datos de abajo son opcionales.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Detalle / Nota</label>
          <Input placeholder="Nota interna (opcional)" value={detalle} onChange={(e) => onChange("detalle", e.target.value)} />
        </div>
      </div>
    </Card>
  );
}
