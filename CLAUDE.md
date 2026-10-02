# CLAUDE.md

Guía para agentes AI (Claude Code, Codex, Cursor, etc.) que trabajan en este repositorio.

Este repo es una **app lista para usar integrada a Ninox ERP** mediante la [integración de terceros](https://docs.ninox.com.ar/docs/terceros): al clonar y correr `npm install && npm run dev` hay una app con login, base SQLite y los módulos catálogo/stock, reservas y ventas, ingesta de datos y reportes. La idea es que cada usuario la **extienda** para su caso (ecommerce, chatbot, sync con CRM, BI…).

## Onboarding

Si la persona recién llega (te pidió empezar, no tiene su propia copia del repo o nunca levantó la app), seguí primero [`ONBOARDING.md`](ONBOARDING.md). Para una tienda online el starter indicado es [ninox-ecommerce-starter](https://github.com/banhaia/ninox-ecommerce-starter).

## Agente experto

`.claude/agents/ninox-integration-expert.md` es un subagente especialista en la API pública de terceros y en esta app. Delegale (o seguí su playbook) cualquier tarea de integración: nuevos endpoints, módulos, depuración de errores de Ninox o pruebas contra la API real con el token del usuario.

## ⚠️ Repositorio público

Nunca commitear:
- tokens (`X-NX-TOKEN`), `.env`, contraseñas o cookies;
- la base SQLite (`data/`, `*.db`) ni respuestas reales de la API;
- nombres de tenants/empresas clientes, CUIT/DNI/emails reales, capturas con datos reales.

Las fixtures de `shared/sample-responses/` son **ficticias** (Remera Básica, Cliente Ejemplo, `ejemplo@example.com`, CUIT `20-00000000-0`). Si agregás una, inventá los datos. El cliente HTTP no loguea bodies ni el token; mantenelo así. CI corre gitleaks sobre todo el historial.

## Commands

```bash
npm install            # instala dependencias (better-sqlite3 trae binario precompilado)
npm run dev            # backend (tsx watch, :3030) + frontend (Vite, :5173, proxya /api)
npm run dev:server     # solo backend
npm run dev:client     # solo frontend
npm run build          # vite build (dist/client) + tsc server (dist/server)
npm start              # sirve dist/ (frontend + API) en :3030
npm run typecheck      # tsc frontend + backend
npm test               # vitest (tests/**/*.test.ts, SQLite en memoria, fetch simulado)
npm run validate       # typecheck + test + build + chequeo de archivos sensibles

node examples/scripts/chatbot-stock.mjs "remera"   # scripts sueltos (requieren NINOX_TOKEN)
node examples/scripts/probe.mjs "/integraciones/terceros/config" --shape   # ver la forma real de una respuesta (solo GET)
cd examples/chatbot-ollama-app && npm install && npm run dev   # ejemplo autocontenido
```

Node 22 (`.nvmrc`), mínimo 20.17.

## Architecture

- **Frontend** (`src/`): React 19 + Vite 7 + Tailwind 3 + React Router 7 + Recharts (solo en Reportes, cargado lazy). Proxy `/api` → `:3030` en dev.
- **Backend** (`server/src/`): Express 4 + better-sqlite3 (WAL, FKs, transacciones). Base en `DATA_DIR/ninox-app.db` (default `./data`, gitignoreado).
- **Contexto** (`server/src/context.ts`): `AppContext { db, settings, limiter, ninox(), hasNinoxConnection() }`. Los módulos reciben el contexto; en tests se crea con SQLite en memoria y `fetchImpl`/reloj simulados.
- **Módulos** (`server/src/modules/<modulo>/`): `routes.ts` + `service.ts`/`repository.ts`. Módulos: `auth`, `settings`, `catalog`, `orders`, `ingest`, `reports`.
- **Cliente Ninox** (`server/src/ninox/`): `client.ts` (HTTP, timeout, reintentos solo en GET), `rate-limiter.ts` (ventanas persistidas), `types.ts` (contrato de la API), `dates.ts` (formato `dd/MM/yyyy HH:mm:ss` UTC).

### Data Model

Migraciones en `server/src/db/migrations.ts` (solo hacia adelante; se aplican al iniciar y quedan en `schema_migrations`).

| Tabla | Uso |
|---|---|
| `users`, `sessions` | Login local. Sesión = hash SHA-256 del token de la cookie `nx_session` (7 días, deslizante) |
| `settings` | Clave/valor: `ninox.env`, `ninox.baseUrl`, `ninox.token`, `ninox.config` (snapshot de GET /config), `orders.ordenIdBase` |
| `api_rate_buckets` | Próxima llamada permitida por bucket de rate limit de Ninox |
| `articulos`, `articulo_variantes`, `tags`, `articulo_tags`, `catalog_sync_runs` | Catálogo (GetData). Reemplazo completo por sync; los que no vienen quedan `eliminado = 1` |
| `orders` | Reservas (`preventa`) y ventas enviadas desde la app. `orden_id` UNIQUE = clave de idempotencia |
| `ingest_jobs`, `ingest_staging` | Cola de ingesta y páginas descargadas de jobs en curso |
| `ventas_items`, `ventas_totales`, `ventas_formas_pago` | Exportación de ventas (FV tipo 2, NC tipo 4). `periodo` + `sucursal_id` = alcance que se reemplaza al reimportar |
| `compras_items`, `compras_totales`, `compras_formas_pago` | Exportación de compras (FC tipo 1, NC tipo 3) |
| `stock_snapshots`, `stock_snapshot_items` | **Preparado**: stock por depósito (`exportar/stock`) |
| `saldos_snapshots`, `saldos_items` | **Preparado**: saldos vencidos de clientes/proveedores |

### Backend Routes

Todo bajo `/api`. Todo excepto `/auth/status|setup|login` requiere sesión.

- `/auth/status` · `POST /auth/setup` (solo si no hay usuarios) · `POST /auth/login` · `POST /auth/logout` · `POST /auth/password`
- `GET /settings` · `PUT /settings/ninox` · `POST /settings/ninox/test` (GET /config y guarda snapshot) · `PUT /settings/orders`
- `GET /dashboard` · `GET /products?search&color&size&limit` · `GET /catalog/status` · `POST /catalog/sync` (429 si el bucket masivo no está libre)
- `GET /medios-pago` (cache 10 min)
- `GET /orders?kind&status` · `GET /orders/next-orden-id` · `GET /orders/:id` · `POST /orders/preventa` · `POST /orders/venta` · `POST /orders/:id/retry` · `POST /orders/:id/cancel` · `GET /orders/:id/comprobante`
- `GET /ingest/types` · `GET /ingest/options` · `GET|POST /ingest/jobs` · `POST /ingest/jobs/:id/cancel|retry` · `GET /ingest/coverage` · `GET /ingest/export/:tabla.csv?desde&hasta&sucursalId`
- `GET /reports/sucursales` · `GET /reports/coverage` · `GET /reports/monthly?desde&hasta&sucursalId` · `GET /reports/top-products?mes` · `GET /reports/payment-methods?mes`

Errores de Ninox se traducen en `server/src/app.ts`: rate limit → 429 (`details.retryAfterSeconds`), error HTTP de Ninox → 502, sin conexión o certificado TLS no confiable → 502 con la causa, timeout → 504, falta token → 412. El server suma los certificados raíz del SO (`server/src/lib/tls.ts`) para APIs locales con certificado de desarrollo.

### Frontend Structure

Rutas (`src/app.tsx`, todas detrás de `AuthProvider`): `/` Inicio (primeros pasos + KPIs de catálogo), `/stock`, `/operaciones/nueva` (reserva o venta), `/operaciones` (listado, cancelar, reintentar, consultar comprobante), `/ingesta`, `/reportes`, `/configuracion`. Sin sesión se muestra `routes/login-page.tsx` (autosetup si no hay usuarios).

- `src/lib/api.ts`: cliente tipado de toda la API. Un 401 dispara `nx:unauthorized` y vuelve al login.
- `src/lib/auth-context.tsx`, `src/lib/format.ts` (ARS, fechas, períodos).
- `src/components/ui/*`: primitivas (button, card, input, select, badge).
- `src/components/stock/`, `src/components/preventa/`, `src/components/charts/chart-theme.ts` (paleta validada: slot 1 azul = ventas, slot 2 naranja = compras).

## Integración Ninox: reglas que el código ya respeta

- **Rate limits** (`ninox/rate-limiter.ts`), prod / test: `masivo` 600 s / 180 s (GetData, GetDataCurva, exportar/stock, exportar/saldos: un solo bucket compartido), `comprobantePaginado` 30 s / 3 s, `saldos` 10 s / 3 s, `parametros` 10 s / 3 s, `comprobante` 10 s / 3 s. Un 403 "Debe esperar N segundos" actualiza el bucket. Acciones manuales usan `take()` (falla rápido); la ingesta usa `acquire()` (espera).
- **Sucursales habilitadas**: exportaciones y saldos responden 403 si la integración no tiene sucursales en `config.sucursalesExportacion`.
- **Pedidos**: `total = subtotal + envio + recargo - descuento`; `entidadId` o `usuario` con dni/cuit/email; éxito solo si `facturaId > 0`. `venta` acepta medios 1, 9, 11. Cancelar usa `?facturaid=` en la query.
- **Idempotencia**: la orden se inserta `pending` antes de llamar a Ninox; timeout → `unknown`; el reintento reutiliza el mismo `ordenId`. Nunca reintentar POST automáticamente.
- **Exportaciones**: se piden por `anio`/`mes` (sin tope de 30 días), `pageSize` 500. No traen id de línea, por eso cada job reemplaza `(sucursal, periodo)` completo en una transacción.
- Rutas con capitalización real: `Terceros/GetData`, `Terceros/GetDataCurva`, `Terceros/Pedido`, `Terceros/Pedido/cancelar`; el resto en minúscula bajo `/integraciones/terceros/`.

## Cómo extender la app (metodología de 5 pasos)

1. **Alcance**: ¿qué módulos usa el caso (catálogo, pedidos, ingesta, reportes)? ¿hay token? Sin token no hay modo demo: los tests usan `shared/sample-responses/`.
2. **Catálogo**: ya sincroniza con GetData. Para `GetDataCurva` o `depositoId`, extender `ninox/client.ts` + `modules/catalog/`.
3. **Normalizar**: agregar columnas vía una **nueva migración** y mapear en el mapper/handler correspondiente.
4. **Sincronizar**: nuevos datos periódicos → un handler en `modules/ingest/handlers.ts` (declarar bucket y alcance). Stock y saldos ya están preparados con `enabled: false`.
5. **Pedidos**: reutilizar `OrdersService`. Probar siempre contra testing.

Para nuevos indicadores: agregar funciones puras en `modules/reports/service.ts` (solo leen la base) + ruta + gráfico en `routes/reports-page.tsx`.

## Key Conventions

- Español en UI, docs y mensajes de error. Montos en ARS. Fechas ISO en la base; `fecha_text` (YYYY-MM-DD) y `periodo` (YYYY-MM) para agrupar.
- TypeScript estricto, sin `any`. 2 espacios, comillas dobles, archivos kebab-case. Imports del server con extensión `.js` (NodeNext).
- Multi-escritura siempre dentro de `db.transaction()`.
- No loguear bodies, tokens ni datos personales. El log HTTP solo registra método, ruta, status y duración.
- Tests en `tests/` con Vitest; cada feature nueva del backend lleva al menos un test con fetch simulado.

## Sincronización de documentación

Después de cada cambio:

- **Nueva ruta API** → actualizar Backend Routes en este archivo.
- **Nueva página** → actualizar Frontend Structure.
- **Nueva tabla/migración** → actualizar Data Model.
- **Nuevo módulo o flujo complejo** → crear `docs/modules/<nombre>.md` y sumarlo a `docs/INDEX.md`.
- **Cambio de contrato con Ninox** → `ninox/types.ts`, `docs/integration-guide.md` y la colección Postman.
- Antes de commitear: `npm run validate`.

## Documentación externa

- API: https://docs.ninox.com.ar/docs/terceros (incluye changelog)
- Alta comercial y token: https://www.ninoxnet.com/integraciones/terceros · dev@banhaia.com
- "Tienda Nube" y "WordPress" son integraciones nativas de Ninox, no usan este flujo.
