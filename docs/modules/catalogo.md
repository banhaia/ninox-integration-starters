# Catálogo y stock

## Propósito

Mantener en SQLite una foto del catálogo de la integración (artículos, variantes talle/color, precios, categorías/etiquetas y stock) para que la UI y otros módulos consulten sin pegarle a Ninox.

## Código

| Archivo | Responsabilidad |
|---|---|
| `server/src/modules/catalog/mapper.ts` | `mapCatalog(GetData)` → filas de `articulos`, `articulo_variantes`, `tags`, `articulo_tags`. Tolerante a campos alternativos (`precioVenta`, `stockCantidad`, `curva.cantidad`) |
| `server/src/modules/catalog/repository.ts` | `replaceCatalog` (transacción), `listStockRows`, `getFacets`, `getSummary` |
| `server/src/modules/catalog/sync-service.ts` | `CatalogSyncService`: sync manual y programado, registro en `catalog_sync_runs` |
| `server/src/modules/catalog/routes.ts` | `/dashboard`, `/products`, `/catalog/status`, `/catalog/sync` |
| `src/routes/home-page.tsx`, `src/routes/stock-page.tsx`, `src/components/stock/` | UI |

## Sync

- **Carga completa:** cada sync hace `GetData`, trae todo el catálogo y lo reemplaza en una sola transacción:
  - borra variantes y relaciones con tags;
  - marca todos los artículos como `eliminado = 1`;
  - hace upsert de los que llegaron, que vuelven a `eliminado = 0`.
- **Automático:** el scheduler evalúa cada minuto. Sincroniza si hay conexión, si pasaron `CATALOG_SYNC_MINUTES` (default 15, mínimo 10) y si el bucket `masivo` está libre.
- **Manual:** si la ventana no está libre, responde 429 con los segundos restantes.
- **Bucket compartido:** el bucket `masivo` también lo usan `exportar/stock` y `exportar/saldos`. Si esos se habilitan, conviene coordinarlos con el sync.

## Precio y stock

- **Precio:** `precio_venta` es `precioVenta` si viene, y si no `precio1`. Se guardan también `precio1` a `precio5`.
- **Stock total:** `stock_total` es `stockTotal` o `stockCantidad`; si no viene ninguno, la suma de las variantes.
- **Stock por variante:** es `unidades`. En modo multidepósito informativo, `unidades` corresponde al depósito principal.

## Extender

- **Stock de un depósito puntual:** `ctx.ninox().getData(depositoId)`. Si hacen falta varios depósitos a la vez, agregar una tabla `articulo_stock_deposito` con una migración nueva.
- **Tiempo real:** un receptor de webhooks de artículos que haga upsert del artículo recibido (ver `docs/integration-guide.md`).
- **Búsqueda más rápida:** una tabla FTS5 sobre `articulos`.
