import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getProducts, type ProductsPayload } from "@/lib/api";

export function StockPage(): JSX.Element {
  const [search, setSearch] = useState("");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [data, setData] = useState<ProductsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const params = useMemo(() => {
    const value = new URLSearchParams();
    if (search) value.set("search", search);
    if (color) value.set("color", color);
    if (size) value.set("size", size);
    return value;
  }, [search, color, size]);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      try {
        const payload = await getProducts(params);
        if (!cancelled) {
          setData(payload);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Listado de stock</h1>
            <p className="text-sm text-muted-foreground">
              Busqueda general + facets de color y talle si existen en el snapshot.
            </p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por codigo, nombre, categoria o tag"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select value={color} onChange={(event) => setColor(event.target.value)} disabled={!data || data.facets.colors.length === 0}>
            <option value="">Todos los colores</option>
            {data?.facets.colors.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <Select value={size} onChange={(event) => setSize(event.target.value)} disabled={!data || data.facets.sizes.length === 0}>
            <option value="">Todos los talles</option>
            {data?.facets.sizes.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
          <div>
            <h2 className="font-semibold">Items locales</h2>
            <p className="text-sm text-muted-foreground">
              {loading ? "Actualizando vista..." : `${data?.total ?? 0} resultados`}
            </p>
          </div>
        </div>

        {!data || data.total === 0 ? (
          <div className="px-5 py-12 text-center text-muted-foreground">
            {loading ? "Cargando stock..." : "No hay productos para esos filtros."}
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {data.items.map((item) => (
              <div key={item.code} className="grid gap-4 px-5 py-4 lg:grid-cols-[2fr_1fr_1fr]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{item.name}</h3>
                    <Badge>{item.code}</Badge>
                    {item.stock === 0 ? <Badge className="bg-red-100 text-red-700">Sin stock</Badge> : null}
                  </div>
                  {item.description ? (
                    <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.categories.map((value) => (
                      <Badge key={`${item.code}-${value}`}>{value}</Badge>
                    ))}
                    {item.tags.map((value) => (
                      <Badge key={`${item.code}-tag-${value}`} className="bg-primary/10 text-primary">
                        {value}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Stock</p>
                    <p className="mt-1 text-2xl font-semibold">{item.stock ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Precio base</p>
                    <p className="mt-1 text-lg font-semibold">
                      {item.price !== null ? item.price.toLocaleString() : "Sin dato"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Colores</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.colors.length > 0 ? item.colors.map((value) => <Badge key={`${item.code}-color-${value}`}>{value}</Badge>) : <span className="text-sm text-muted-foreground">No detectados</span>}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Talles</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.sizes.length > 0 ? item.sizes.map((value) => <Badge key={`${item.code}-size-${value}`}>{value}</Badge>) : <span className="text-sm text-muted-foreground">No detectados</span>}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Variantes</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.variants.length} variantes</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
