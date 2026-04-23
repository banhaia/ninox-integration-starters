# stock-dashboard-app

## Propósito

Ejemplo full-stack para consultar catálogo/stock de Ninox, cachearlo localmente y operar preventas o ventas directas. Es la referencia principal del repo para flujos Ninox completos: sync de catálogo, dashboard, búsqueda de stock, medios de pago, creación de pedidos e historial local.

## Mapa de Código

### Backend

- `examples/stock-dashboard-app/server/src/index.ts`: entrypoint Express, static serving del frontend compilado, logging HTTP e inicialización del sync.
- `examples/stock-dashboard-app/server/src/routes/api.ts`: endpoints REST de dashboard, productos, sync, medios de pago, preventas, ventas e historial.
- `examples/stock-dashboard-app/server/src/services/catalog-sync-service.ts`: orquesta el ciclo fetch desde fuente, normalización, persistencia y estado de sync.
- `examples/stock-dashboard-app/server/src/services/catalog-repository.ts`: lee/escribe `examples/stock-dashboard-app/data/catalog-cache.json`.
- `examples/stock-dashboard-app/server/src/services/catalog-query-service.ts`: funciones puras para resumen, facetas, filas de stock y filtros.
- `examples/stock-dashboard-app/server/src/services/container.ts`: instancia singleton de `CatalogSyncService`.
- `examples/stock-dashboard-app/server/src/sources/catalog-source.ts`: contrato para fuentes de catálogo.
- `examples/stock-dashboard-app/server/src/sources/ninox-catalog-source.ts`: fuente Ninox que usa el template compartido.
- `examples/stock-dashboard-app/server/src/services/preventa-history-service.ts`: persistencia de operaciones exitosas en `data/preventa-history.json`.
- `examples/stock-dashboard-app/server/src/types/catalog.ts`: tipos de snapshot y estado de sync.
- `examples/stock-dashboard-app/server/src/types/preventas.ts`: contrato camelCase para pedidos y validación server-side.

### Frontend

- `examples/stock-dashboard-app/src/app.tsx`: router React con rutas de dashboard, stock, preventas e historial.
- `examples/stock-dashboard-app/src/lib/api.ts`: cliente fetch tipado para todos los endpoints del backend.
- `examples/stock-dashboard-app/src/routes/home-page.tsx`: KPIs, facetas y estado de sincronización.
- `examples/stock-dashboard-app/src/routes/stock-page.tsx`: tabla/listado de stock con filtros.
- `examples/stock-dashboard-app/src/routes/preventa-page.tsx`: propietario del formulario de preventa/venta y armado del payload.
- `examples/stock-dashboard-app/src/routes/history-page.tsx`: historial de operaciones.
- `examples/stock-dashboard-app/src/components/preventa/`: componentes del formulario de pedido: búsqueda de artículos, cliente, líneas, totales, pagos y resultado.
- `examples/stock-dashboard-app/src/components/layout-shell.tsx`: navegación y layout principal.

### Template Compartido

- `templates/node-typescript/src/client/ninoxClient.ts`: cliente HTTP Ninox con token, timeout y endpoints `GetData`, medios de pago y pedido.
- `templates/node-typescript/src/services/productService.ts`: normalización de respuestas Ninox a `Product[]`.
- `templates/node-typescript/src/types/product.ts`: tipos base de producto, variante, precio, categoría y tags.

## Flujos Principales

- Sync de catálogo: `index.ts` inicializa `catalogSyncService`; el servicio carga snapshot local, sincroniza si está vacío, y repite cada `CATALOG_SYNC_INTERVAL_MS`.
- Consulta de stock: `/api/products` obtiene productos normalizados, los aplana con `buildStockRows()` y aplica filtros de texto, color y talle.
- Dashboard: `/api/dashboard` compone estado de sync, resumen de stock y facetas.
- Preventa/venta: el frontend arma un payload camelCase, el server valida totales y campos mínimos, llama `NinoxClient.createPedido()`, y guarda historial si Ninox devuelve éxito.
- Medios de pago: `/api/medios-pago` consulta Ninox con caché in-memory para evitar requests repetidos dentro de la ventana mínima.

## Endpoints

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/api/dashboard` | KPIs, estado y facetas |
| GET | `/api/products` | Stock filtrado por `search`, `color`, `size` |
| POST | `/api/sync` | Sync manual de catálogo |
| GET | `/api/medios-pago` | Medios de pago Ninox cacheados |
| POST | `/api/preventas` | Crear preventa/pedido |
| POST | `/api/ventas` | Crear venta directa/pedido |
| GET | `/api/preventa-history` | Historial local de operaciones |

## Variables y Datos

- `NINOX_BASE_URL`: base URL de Ninox.
- `NINOX_TOKEN`: token de terceros para header `X-NX-TOKEN`.
- `NINOX_TIMEOUT_MS`: timeout del cliente Ninox, si se configura.
- `CATALOG_SYNC_INTERVAL_MS`: intervalo de sync; default 10 minutos.
- `PORT`: puerto Express; default 3030.
- `examples/stock-dashboard-app/data/catalog-cache.json`: snapshot local de catálogo.
- `examples/stock-dashboard-app/data/preventa-history.json`: historial local de pedidos exitosos.

## Puntos de Extensión

- Nueva fuente de catálogo: implementar `CatalogSource` y registrarla en `services/container.ts`.
- Nueva vista/filtro de stock: extender `catalog-query-service.ts` y el cliente tipado en `src/lib/api.ts`.
- Nuevos campos de pedido: actualizar tipos en `server/src/types/preventas.ts`, construcción en `preventa-page.tsx` y componentes del formulario.
- Persistencia alternativa: reemplazar `CatalogRepository` o `preventa-history-service.ts` por SQLite/Redis sin tocar la UI si se conserva el contrato del router.

## Cuidados

- Respetar la frecuencia mínima de Ninox para `GetData`: no bajar el intervalo por debajo de 10 minutos salvo entorno controlado.
- No exponer `NINOX_TOKEN` al frontend.
- `codigo` no equivale a `articuloId`; para pedidos se preservan IDs desde `product.raw`.
- Un HTTP 200 de pedido no garantiza éxito; validar el resultado de negocio devuelto por Ninox.
- Mantener imports NodeNext con extensión `.js` en archivos server.
