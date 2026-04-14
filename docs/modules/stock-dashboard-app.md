# stock-dashboard-app

## Propósito

App full-stack de referencia para integraciones con Ninox ERP. Sincroniza el catálogo de artículos contra la API de Ninox, lo persiste en un snapshot local y expone:

- Consulta de stock y catálogo con filtros
- Creación de preventas y ventas directas
- Historial de operaciones exitosas
- Dashboard de estado de sincronización

Sirve como ejemplo de arquitectura para cualquier integración de terceros con Ninox.

---

## Archivos principales

### Backend (`server/src/`)

- `/examples/stock-dashboard-app/server/src/index.ts` — entry point Express; monta el router, el middleware de logging HTTP y arranca el sync
- `/examples/stock-dashboard-app/server/src/routes/api.ts` — todos los endpoints REST del backend
- `/examples/stock-dashboard-app/server/src/services/catalog-sync-service.ts` — orquesta ciclo de sync: fetch → normalización → persistencia → estado
- `/examples/stock-dashboard-app/server/src/services/catalog-repository.ts` — lectura/escritura del snapshot en `data/catalog-cache.json`
- `/examples/stock-dashboard-app/server/src/services/catalog-query-service.ts` — transformaciones puras: resumen, facetas, filas de stock, filtros
- `/examples/stock-dashboard-app/server/src/services/preventa-history-service.ts` — lectura/escritura del historial en `data/preventa-history.json`
- `/examples/stock-dashboard-app/server/src/services/container.ts` — instancia singleton de `CatalogSyncService` con su configuración
- `/examples/stock-dashboard-app/server/src/sources/ninox-catalog-source.ts` — fuente de datos Ninox; implementa la interfaz `CatalogSource`
- `/examples/stock-dashboard-app/server/src/types/catalog.ts` — tipos `CatalogSnapshot` y `SyncState`
- `/examples/stock-dashboard-app/server/src/types/preventas.ts` — tipos camelCase del contrato Ninox (`PedidoTerceros`, `DireccionTerceros`, `UsuarioTerceros`, `ArticuloTerceros`) y función `validateSaleBody()`

### Frontend (`src/`)

- `/examples/stock-dashboard-app/src/app.tsx` — router React con cuatro rutas: `/`, `/stock`, `/preventas`, `/historial`
- `/examples/stock-dashboard-app/src/lib/api.ts` — cliente fetch tipado; define interfaces y funciones de acceso a todos los endpoints
- `/examples/stock-dashboard-app/src/lib/preventa-types.ts` — tipos internos del formulario (`PreventaFormState`, `FormLinea`, `FormMedioPago`, enums `CONDICION_IVA`, `TIPO_MEDIO`)
- `/examples/stock-dashboard-app/src/components/layout-shell.tsx` — layout principal con nav
- `/examples/stock-dashboard-app/src/routes/home-page.tsx` — dashboard con KPIs y estado de sync
- `/examples/stock-dashboard-app/src/routes/stock-page.tsx` — listado de stock con filtros
- `/examples/stock-dashboard-app/src/routes/preventa-page.tsx` — formulario completo de preventa/venta; propietario del estado del form
- `/examples/stock-dashboard-app/src/routes/history-page.tsx` — historial de operaciones con detalle expandible
- `/examples/stock-dashboard-app/src/components/preventa/article-search.tsx` — buscador de artículos con debounce; resuelve `articuloId`, `talleId` y `colorId`
- `/examples/stock-dashboard-app/src/components/preventa/customer-form.tsx` — datos de cliente y dos bloques de dirección
- `/examples/stock-dashboard-app/src/components/preventa/line-items-table.tsx` — tabla de líneas con edición de cantidad y eliminación
- `/examples/stock-dashboard-app/src/components/preventa/totals-panel.tsx` — subtotal calculado, descuento/recargo/envío editables, total derivado
- `/examples/stock-dashboard-app/src/components/preventa/payment-selector.tsx` — selección de medio de pago; maneja estados de carga y error con retry
- `/examples/stock-dashboard-app/src/components/preventa/order-header.tsx` — inputs de `ordenId`, `numero` y `detalle`
- `/examples/stock-dashboard-app/src/components/preventa/result-banner.tsx` — banner dismissible de éxito/error

### Template compartido

- `/templates/node-typescript/src/client/ninoxClient.ts` — `NinoxClient`; cliente HTTP con token, timeout y logging de requests salientes
- `/templates/node-typescript/src/services/productService.ts` — `normalizeProducts()`; mapea respuesta cruda de Ninox a `Product[]`

### Datos persistidos

- `/examples/stock-dashboard-app/data/catalog-cache.json` — snapshot del catálogo (sourceId, syncedAt, products[])
- `/examples/stock-dashboard-app/data/preventa-history.json` — historial de operaciones (array de `HistoryEntry`)

---

## Funciones/Métodos clave

### CatalogSyncService
- `init()` — carga snapshot existente; dispara sync inicial si no hay datos; arranca intervalo periódico
- `syncNow()` — fetch desde la fuente activa → normalización → persistencia; retorna `{ started, message }`
- `getProducts()` — lee snapshot y re-normaliza antes de devolver
- `getStatus()` — estado actual del ciclo de sync

### CatalogRepository
- `read()` — lee `catalog-cache.json`; devuelve snapshot vacío si no existe
- `write()` — persiste snapshot

### catalog-query-service (funciones puras)
- `buildSummary()` — agrega KPIs del catálogo
- `buildFacets()` — extrae colores y talles únicos
- `buildStockRows()` — aplana `Product[]` a filas UI; preserva `articuloId`, `talleId`, `colorId` desde `.raw`
- `filterStockRows()` — filtra por texto, color y talle

### preventa-history-service
- `appendHistoryEntry()` — agrega una entrada al JSON de historial
- `getHistory()` — lee y devuelve el historial completo

### NinoxClient
- `getProducts()` — GET `/integraciones/Terceros/GetData`
- `getMediosPago()` — GET `/integraciones/terceros/medios-pago`
- `createPedido()` — POST `/integraciones/Terceros/Pedido`

### validateSaleBody() (server)
- Valida presencia de campos requeridos y la fórmula `total = subtotal + envio + recargo - descuento`

### buildPayload() (preventa-page, cliente)
- Construye el `PedidoTerceros` camelCase a partir del estado del formulario

---

## Endpoints REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/dashboard` | KPIs, estado de sync y facetas |
| GET | `/api/products` | Listado filtrado de artículos (`?search`, `?color`, `?size`) |
| POST | `/api/sync` | Dispara sync manual |
| GET | `/api/medios-pago` | Medios de pago desde Ninox (cacheado 10 min) |
| POST | `/api/preventas` | Crea preventa vía `/integraciones/Terceros/Pedido` |
| POST | `/api/ventas` | Crea venta directa vía el mismo endpoint |
| GET | `/api/preventa-history` | Historial de operaciones exitosas |

---

## Dependencias externas

- **Ninox ERP API** — base URL configurable via `NINOX_BASE_URL`; autenticación por header `X-NX-TOKEN`
- `ninox-node-typescript-template` — paquete local con `NinoxClient` y `normalizeProducts()`
- Express 4 (server), React 19 + React Router 7 (client), Tailwind CSS, Vite

---

## Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `NINOX_BASE_URL` | Sí | URL base de la API Ninox (test o producción) |
| `NINOX_TOKEN` | Sí | Token `X-NX-TOKEN` de la integración |
| `PORT` | No | Puerto del servidor (default: 3030) |
| `CATALOG_SYNC_INTERVAL_MS` | No | Intervalo de sync automático (default: 600000 = 10 min) |

---

## Flujo principal

### Sync de catálogo
1. Al iniciar, `CatalogSyncService.init()` lee el snapshot local
2. Si está vacío y hay fuente configurada, dispara `syncNow()` inmediatamente
3. `syncNow()` llama a `NinoxCatalogSource.fetchProducts()` → `NinoxClient.getProducts()`
4. El resultado crudo se normaliza con `normalizeProducts()` y se persiste en `catalog-cache.json`
5. El intervalo periódico repite el paso 3-4 cada `CATALOG_SYNC_INTERVAL_MS`

### Creación de preventa/venta
1. El usuario completa el formulario en `/preventas`
2. `validateForm()` en cliente verifica campos requeridos y que `total > 0`
3. `buildPayload()` construye el `PedidoTerceros` en camelCase
4. El frontend POST a `/api/preventas` o `/api/ventas`
5. El servidor corre `validateSaleBody()` (segunda capa de validación)
6. `NinoxClient.createPedido()` hace POST a `/integraciones/Terceros/Pedido`
7. La respuesta se evalúa: `facturaId > 0` → éxito; `facturaId === 0` → error con mensaje de `datos`
8. Si exitoso, `appendHistoryEntry()` persiste en `preventa-history.json`
9. El frontend muestra `ResultBanner` con el resultado

### Draft del formulario
- `Guardar borrador` → `localStorage` (`ninox-preventa-draft`)
- `Exportar JSON` → descarga blob en el navegador
- `Importar JSON` → carga desde archivo local vía `FileReader`

---

## Notas relevantes

- **`articuloId` vs `codigo`**: el campo `codigo` del artículo (string) NO es el `articuloId` numérico que espera Ninox en el pedido. `buildStockRows()` lee `articuloId` desde `product.raw` para preservarlo; si un artículo no tiene `articuloId` en el catálogo local, el botón "Agregar" queda deshabilitado.
- **Rate limit de sync**: `GetData` y `GetDataCurva` tienen frecuencia mínima de 10 minutos. El endpoint `/api/medios-pago` tiene caché in-memory de 10 minutos para el mismo motivo.
- **React StrictMode**: monta los componentes dos veces en desarrollo; el caché de medios-pago evita que esto genere dos requests reales a Ninox.
- **Comportamiento del pedido**: el endpoint `/integraciones/Terceros/Pedido` genera preventa o venta directa según la configuración del token; no hay un endpoint separado por tipo.
- **Validación de respuesta Ninox**: un HTTP 200/201 no garantiza éxito; hay que verificar que `facturaId > 0`. El campo `datos` contiene el detalle del error cuando `facturaId === 0`.
- **Un token = un depósito + un punto de venta**: múltiples depósitos requieren integraciones separadas.
