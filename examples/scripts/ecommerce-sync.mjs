// Mapea el catálogo de Ninox (GetData) al formato típico de un storefront e imprime 10 ítems.
// Uso: NINOX_TOKEN=... node examples/scripts/ecommerce-sync.mjs
import { ninoxGet } from "./ninox.mjs";

const articulos = await ninoxGet("/integraciones/Terceros/GetData");

const storefront = articulos.map((a) => ({
  sku: a.codigo,
  title: a.nombre ?? a.descripcion,
  description: a.descripcionWeb ?? a.descripcion ?? "",
  categories: (a.tags ?? []).filter((t) => t.tipo === 1).map((t) => t.tagNombre),
  tags: (a.tags ?? []).filter((t) => t.tipo !== 1).map((t) => t.tagNombre),
  price: a.precioVenta ?? a.precio1 ?? null,
  stock: a.stockTotal ?? 0,
  variants: (a.curva ?? []).map((v) => ({
    sku: `${a.codigo}-${v.colorId ?? 0}-${v.talleId ?? 0}`,
    title: [v.colorNombre, v.talleNombre].filter(Boolean).join(" / "),
    stock: v.unidades ?? 0
  }))
}));

console.log(JSON.stringify(storefront.slice(0, 10), null, 2));
