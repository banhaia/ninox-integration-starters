# Guía técnica: integración de terceros de Ninox

Referencia de la API y de cómo la usa esta app. La documentación oficial y su changelog están en https://docs.ninox.com.ar/docs/terceros. Ante cualquier diferencia, manda la documentación oficial.

## Entornos y autenticación

| Entorno | Base URL |
|---|---|
| Testing | `https://api.test-ninox.com.ar` |
| Producción | `https://api.ninox.com.ar` |

```
X-NX-TOKEN: <token>
Content-Type: application/json
```

- **Alcance del token:** un token corresponde a una integración, con un depósito y un punto de venta por defecto.
- **Sucursales habilitadas:** el acceso a datos está acotado a las **sucursales habilitadas** de la integración, que configura el administrador en Ninox (*Configuración › Canales*). Sin sucursales habilitadas, las exportaciones, `saldos/*` y `stock/movimiento` responden 403 (deny-by-default).

## Formato de datos

- JSON en camelCase; enums como enteros.
- **Fechas:** `DateTime` llega como `"dd/MM/yyyy HH:mm:ss"` en UTC. Ver `server/src/ninox/dates.ts`.
- **Exportaciones:** traen `fechaText` (`yyyy-MM-dd`), que es lo que usa la app para agrupar.

## Endpoints

Prefijo `/integraciones/terceros` (las rutas históricas usan `Terceros` con mayúscula).

| Método | Ruta | Uso en la app |
|---|---|---|
| GET | `config` | Probar conexión; guarda sucursales habilitadas, depósitos, punto de venta, `flujoDeposito` |
| GET | `medios-pago` | Formulario de ventas |
| GET | `Terceros/GetData` (`?depositoId=`) | Sync de catálogo |
| GET | `Terceros/GetDataCurva` | Catálogo plano por variante (no usado; mismo bucket que GetData) |
| POST | `Terceros/Pedido` | Crear reserva (preventa) |
| POST | `Terceros/Pedido/cancelar?facturaid=` | Cancelar reserva (el id va en la **query**) |
| POST | `venta` | Venta directa con `medioPago` (tipos 1, 9, 11) |
| POST | `notacredito` | Nota de crédito (no expuesto en la UI) |
| GET | `comprobante/{facturaId}` | Consultar estado actual de un comprobante |
| GET | `exportar/ventaitems/paginado` | Ingesta: ventas por ítem |
| GET | `exportar/ventatotales/paginado` | Ingesta: ventas por comprobante (+ medios de pago) |
| GET | `exportar/compraitems/paginado` | Ingesta: compras por ítem |
| GET | `exportar/compratotales/paginado` | Ingesta: compras por comprobante |
| GET | `exportar/stock?depositoId=` | Preparado: snapshot de stock por depósito |
| GET | `saldos/clientes/paginado`, `saldos/proveedores/paginado` | Preparado: saldos vencidos |
| GET | `entidades`, `empleados`, `puntos-venta`, `depositos` | Descubrir ids (no usados todavía) |
| GET/POST/DELETE | `config/webhooks` | Webhooks de artículos por API (no usados todavía) |

## Rate limits

Un rechazo por rate limit es un **403** con el texto `"Debe esperar N segundos entre cada solicitud"`.

| Bucket | Endpoints | Prod | Test |
|---|---|---|---|
| masivo (compartido) | GetData, GetDataCurva, `exportar/stock`, `exportar/clientes`, `exportar/saldos/*`, `exportar/ventaitems` no paginado | 10 min | 3 min |
| comprobante paginado (compartido) | los 4 `exportar/*/paginado` | 30 s | 3 s |
| saldos | `saldos/*` | 10 s | 3 s |
| parámetros | `config`, `medios-pago`, `depositos`, `empleados`, `puntos-venta`, `motivos` | 10 s | 3 s |
| comprobante | `comprobante/{id}` | 10 s | 3 s |

La app guarda la próxima llamada permitida por bucket en SQLite (`api_rate_buckets`), así que un reinicio no dispara 403. Detalle en [modules/cliente-ninox.md](./modules/cliente-ninox.md).

## Pedidos y ventas

- `total = subtotal + envio + recargo - descuento`. Si no cierra, Ninox responde 422, y la app lo valida antes de enviar.
- Hay que mandar `entidadId` (cliente existente) **o** `usuario` con al menos `dni`, `cuit` o `email`. Sin ninguno de los dos, 400. Un `entidadId` inválido da 403.
- `empleadoId` es opcional y fija el vendedor. Si no se envía, se usa el vendedor configurado en la integración.
- Éxito solo si `facturaId > 0`. Si no, el motivo viene en `datos`.
- **Idempotencia:** `ordenId` único y estable. La app lo asigna antes de llamar y reintenta siempre con el mismo. Para reconciliar después de un timeout se usa `GET comprobante/{id}`.

## Exportaciones

- **Parámetros:**
  - `sucursalId` (requerido, debe estar habilitada).
  - Un período: `desde`/`hasta` (máximo 30 días), `fecha`, o `anio`+`mes` (mes completo, sin tope). La app usa `anio`/`mes`.
  - `page` (desde 1), `pageSize` (máximo 500), `incluirMediosPago`.
- **Respuesta:** `{ items, totalRegistros, totalPaginas, paginaActual, pageSize }`.
- **Sin ids:** las filas **no traen** id de línea ni ids numéricos de artículo, cliente o proveedor: solo `codigo` y nombres. Por eso la ingesta reemplaza el alcance completo (sucursal + mes) en cada importación.
- **Tipos de comprobante:**
  - Venta: 2 factura, 4 nota de crédito.
  - Compra: 1 factura, 3 nota de crédito.
  - Las NC restan en los reportes.
- **Precios de venta:** `precioVentaFinal` es el precio unitario final del ítem, y `costoItem` el costo unitario.

## Novedades recientes de la API (changelog 2026)

| Fecha | Cambio | Impacto en la app |
|---|---|---|
| 2026-08-26 | `entidadId` opcional en Pedido, Venta y NC | Campo "Cliente existente" en Nueva operación |
| 2026-08-20 | Exportación de compras (ítems y totales) y de ventas por totales; bucket paginado compartido de 30 s / 3 s | Base del módulo de Ingesta |
| 2026-08-18 | Stock por depósito en webhooks (`stockDepositos`), `flujoDeposito` en `/config`, `depositoId` en GetData y GetDataCurva | `flujoDeposito` guardado con la config; `getData(depositoId)` en el cliente |
| 2026-08-13 | `GET comprobante/{id}`, `empleados`, `puntos-venta`, `empleadoId` | Consulta de comprobante en Reservas y ventas |
| 2026-08-06 | Sucursales habilitadas (deny-by-default en exportaciones) | Selector de sucursal y aviso en Ingesta |
| 2026-07-31 | Webhooks configurables por API | Pendiente (ver próximos pasos) |
| 2026-07-06 | Nota de crédito | Tipo en el cliente; no expuesto en la UI |
| 2026-06-29/30 | Exportación de ventas paginada | Ingesta de ventas |

## Webhooks

Ninox puede notificar cambios de artículos (`topic: "articulos"`) a una URL propia:

- **Configuración:** se hace por API (`config/webhooks`).
- **Payload:** con `extra: null | "curva"` es `ArticuloConCurva[]`; con `"objeto"` es un `Articulo`.
- **Respuesta esperada:** el receptor debe responder 200 en menos de 10 s.
- **Estado actual:** la app todavía no expone un receptor. Es el próximo paso natural para actualizar stock sin esperar el sync de 10 minutos: un `POST /api/webhooks/ninox` público con un secreto en header, que actualice `articulos` y `articulo_variantes`.

## Seguridad

- El token vive solo en el backend (tabla `settings` o `.env`) y la API nunca lo devuelve completo.
- El cliente HTTP no loguea bodies ni query strings con datos personales.
- Nunca hay reintentos automáticos de POST de comprobantes.

## Archivos clave

| Archivo | Qué contiene |
|---|---|
| `server/src/ninox/types.ts` | Contrato tipado de la API |
| `server/src/ninox/client.ts` | Cliente HTTP |
| `server/src/ninox/rate-limiter.ts` | Buckets y ventanas |
| `server/src/modules/*` | Módulos de la app |
| `shared/sample-responses/` | Respuestas ficticias con la forma real (usadas en tests) |
| `shared/postman/` | Colección Postman |
