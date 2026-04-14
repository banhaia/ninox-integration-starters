import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { getProducts } from "@/lib/api";
import type { StockRow } from "@/lib/api";
import type { FormLinea } from "@/lib/preventa-types";

interface ArticleSearchProps {
  onAdd: (line: FormLinea) => void;
}

export function ArticleSearch({ onAdd }: ArticleSearchProps): JSX.Element {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<StockRow | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | "">("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    let cancelled = false;

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ search });
        const data = await getProducts(params);
        if (!cancelled) setResults(data.items.slice(0, 20));
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const selectItem = (item: StockRow): void => {
    setSelected(item);
    setCantidad(1);
    setSelectedVariantIndex("");
  };

  // Variantes con IDs conocidos (tienen talleId o colorId)
  const variantsWithIds = selected?.variants.filter(
    (v) => v.talleId !== undefined || v.colorId !== undefined
  ) ?? [];

  const hasVariants = variantsWithIds.length > 0;

  const selectedVariant =
    selectedVariantIndex !== "" ? variantsWithIds[selectedVariantIndex] : undefined;

  const handleAdd = (): void => {
    if (!selected) return;

    if (selected.articuloId === null) {
      // articuloId no disponible en el catálogo local — no se puede enviar
      return;
    }

    const line: FormLinea = {
      articleId: selected.articuloId,
      articleCode: selected.code,
      articleName: selected.name,
      precio: selected.price ?? 0,
      cantidad,
      talleId: selectedVariant?.talleId,
      colorId: selectedVariant?.colorId,
      talleLabel: selectedVariant
        ? selectedVariant.name
        : undefined
    };

    onAdd(line);
    setSelected(null);
    setSearch("");
    setResults([]);
    setCantidad(1);
    setSelectedVariantIndex("");
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar artículo por nombre, código o categoría..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelected(null);
          }}
          className="pl-9"
        />
        {loading && (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {results.length > 0 && !selected && (
        <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-background shadow-sm">
          {results.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => selectItem(item)}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/60 transition-colors",
                "border-b border-border/40 last:border-0"
              )}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  {item.articuloId === null && (
                    <AlertTriangle className="h-3 w-3 text-amber-400" title="Sin articuloId" />
                  )}
                  <p className="font-medium">{item.name}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  #{item.code}
                  {item.articuloId !== null ? ` · ID: ${item.articuloId}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0 ml-4">
                <p className="font-medium tabular-nums">${item.price?.toFixed(2) ?? "—"}</p>
                <p className="text-xs text-muted-foreground">stock: {item.stock ?? "—"}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-sm">{selected.name}</p>
              <p className="text-xs text-muted-foreground">
                #{selected.code}
                {selected.articuloId !== null
                  ? ` · ID: ${selected.articuloId}`
                  : " · ⚠ Sin articuloId"}
                {" · "}${selected.price?.toFixed(2) ?? "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setSelected(null); setSearch(""); setResults([]); }}
              className="text-xs text-muted-foreground hover:text-foreground shrink-0"
            >
              Cambiar
            </button>
          </div>

          {selected.articuloId === null && (
            <p className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Este artículo no tiene articuloId en el catálogo local. Forzá una sincronización y reintentá.
            </p>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Cantidad</label>
              <Input
                type="number"
                min={1}
                value={cantidad}
                onChange={(e) => setCantidad(Math.max(1, Number(e.target.value)))}
                className="h-8 w-20 text-center text-sm"
              />
            </div>

            {hasVariants && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium">Variante</label>
                <Select
                  value={selectedVariantIndex === "" ? "" : String(selectedVariantIndex)}
                  onChange={(e) =>
                    setSelectedVariantIndex(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="h-8 text-sm"
                >
                  <option value="">Sin especificar</option>
                  {variantsWithIds.map((v, i) => (
                    <option key={i} value={i}>
                      {v.name}
                      {v.talleId ? ` (talleId: ${v.talleId})` : ""}
                      {v.colorId ? ` (colorId: ${v.colorId})` : ""}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <Button
              type="button"
              onClick={handleAdd}
              disabled={selected.articuloId === null}
              className="h-8 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
