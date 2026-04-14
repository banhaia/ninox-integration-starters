import { AlertTriangle, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { FormLinea } from "@/lib/preventa-types";

interface LineItemsTableProps {
  lines: FormLinea[];
  onRemove: (index: number) => void;
  onUpdateCantidad: (index: number, cantidad: number) => void;
}

export function LineItemsTable({ lines, onRemove, onUpdateCantidad }: LineItemsTableProps): JSX.Element {
  if (lines.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No hay artículos agregados. Usá el buscador para agregar líneas.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 text-xs uppercase text-muted-foreground">
            <th className="pb-2 text-left font-medium">Artículo</th>
            <th className="pb-2 text-right font-medium">Precio</th>
            <th className="pb-2 text-center font-medium">Cantidad</th>
            <th className="pb-2 text-right font-medium">Subtotal</th>
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {lines.map((line, i) => (
            <tr key={i} className="group">
              <td className="py-2 pr-4">
                <div className="flex items-center gap-1.5">
                  {line.idWarning && (
                    <AlertTriangle
                      className="h-3.5 w-3.5 shrink-0 text-amber-500"
                      title="No se pudo determinar el ArticuloId numérico. Verificar antes de enviar."
                    />
                  )}
                  <div>
                    <p className="font-medium leading-tight">{line.articleName}</p>
                    <p className="text-xs text-muted-foreground">
                      #{line.articleCode}
                      {line.talleLabel && ` · ${line.talleLabel}`}
                      {line.colorLabel && ` · ${line.colorLabel}`}
                    </p>
                  </div>
                </div>
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                ${line.precio.toFixed(2)}
              </td>
              <td className="py-2 px-2 text-center">
                <Input
                  type="number"
                  min={1}
                  value={line.cantidad}
                  onChange={(e) => onUpdateCantidad(i, Math.max(1, Number(e.target.value)))}
                  className="mx-auto h-7 w-16 text-center text-sm"
                />
              </td>
              <td className="py-2 pl-4 text-right tabular-nums font-medium">
                ${(line.precio * line.cantidad).toFixed(2)}
              </td>
              <td className="py-2 pl-2 text-right">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500"
                  onClick={() => onRemove(i)}
                  aria-label="Eliminar línea"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
