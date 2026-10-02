# Ingesta de datos

## Propósito

Traer a SQLite los datos transaccionales de Ninox (ventas y compras con ítems detallados, totales y medios de pago) para analizarlos localmente. El módulo está preparado para sumar stock por depósito y saldos.

## Código

| Archivo | Responsabilidad |
|---|---|
| `server/src/modules/ingest/handlers.ts` | Un `IngestHandler` por tipo: cómo pedir una página y cómo volcar las filas |
| `server/src/modules/ingest/runner.ts` | `IngestRunner`: cola, paginación, staging, reanudación y cancelación |
| `server/src/modules/ingest/routes.ts` | `/ingest/*` (jobs, cobertura, CSV) |
| `src/routes/ingest-page.tsx` | UI |

## Tipos

| Tipo | Endpoint | Tablas | Estado |
|---|---|---|---|
| `ventas_items` | `exportar/ventaitems/paginado` | `ventas_items` | Activo |
| `ventas_totales` | `exportar/ventatotales/paginado` + `incluirMediosPago` | `ventas_totales`, `ventas_formas_pago` | Activo |
| `compras_items` | `exportar/compraitems/paginado` | `compras_items` | Activo |
| `compras_totales` | `exportar/compratotales/paginado` + `incluirMediosPago` | `compras_totales`, `compras_formas_pago` | Activo |
| `stock` | `exportar/stock?depositoId` | `stock_snapshots`, `stock_snapshot_items` | Preparado |
| `saldos_clientes` / `saldos_proveedores` | `saldos/{tipo}/paginado` | `saldos_snapshots`, `saldos_items` | Preparado |

## Cómo corre un job

1. `POST /ingest/jobs { types, sucursalId, desde, hasta }` crea **un job por tipo y por mes** (`periodo = YYYY-MM`). Si ya hay uno igual en cola o corriendo, lo saltea.
2. El runner toma los jobs de a uno, en orden. Para cada página:
   1. `limiter.acquire("comprobantePaginado")`: espera 30 s en producción o 3 s en testing.
   2. Pide la página (`anio`, `mes`, `pageSize = 500`).
   3. Guarda las filas en `ingest_staging` y el progreso (`page`, `total_pages`, `rows`) en una transacción.
3. **Commit:** en una sola transacción el handler borra el alcance `(sucursal_id, periodo)` de sus tablas, inserta lo descargado y limpia staging. Así reimportar un mes nunca duplica (las exportaciones no traen id de línea).
4. **Errores y cortes:**
   - Si un 403 dice "Debe esperar N segundos", el runner reintenta la página (hasta 5 veces).
   - Otros errores dejan el job `failed` con la página alcanzada, y **Reintentar** retoma desde ahí.
   - Si el server se reinicia, los jobs `running` vuelven a `queued` y retoman.
5. **Cancelar:** aborta la espera o la request en curso.

## Tiempos

Un mes con 20.000 ítems son 40 páginas: unos 20 minutos en producción. Los cuatro tipos comparten el mismo bucket, así que se procesan en serie.

## Activar stock y saldos (próxima etapa)

El esquema (migración `005_ingest_prepared`), los métodos del cliente (`exportStock`, `saldosPaginado`) y los handlers ya existen con `enabled: false`. Para activarlos:

1. Poner `enabled: true` en `handlers.ts`.
2. En `routes.ts`, aceptar `depositoId` (stock) o solo `sucursalId` (saldos) según `handler.scope`. Hoy `POST /jobs` exige un rango de meses.
3. En la UI, un formulario para ese alcance (depósitos desde `GET /ingest/options`).
4. Tener en cuenta los límites:
   - `exportar/stock` usa el bucket `masivo` (10 minutos, compartido con GetData) y requiere plan Empresa o superior.
   - `saldos/*/paginado` usa un bucket de 10 s y `pageSize` de 100 como máximo.
   - Cada ejecución crea un snapshot nuevo. Si hace falta, sumar una política de retención.

## Exportar CSV

`GET /api/ingest/export/{ventas_items|ventas_totales|compras_items|compras_totales}.csv?desde=YYYY-MM&hasta=YYYY-MM&sucursalId=` descarga desde la base local, con BOM UTF-8 para Excel.
