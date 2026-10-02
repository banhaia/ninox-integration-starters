# Reservas y ventas

## Propósito

Crear reservas (preventas, `POST Pedido`) y ventas directas (`POST venta`) desde la app, con registro local e idempotencia.

## Código

| Archivo | Responsabilidad |
|---|---|
| `server/src/modules/orders/validation.ts` | Valida el cuerpo y arma el payload de Ninox (recalcula subtotal y total) |
| `server/src/modules/orders/service.ts` | `OrdersService`: crear, reintentar, cancelar, consultar comprobante, listar |
| `server/src/modules/orders/routes.ts` | `/orders/*` y `/medios-pago` |
| `src/routes/preventa-page.tsx`, `src/components/preventa/` | Formulario "Nueva operación" |
| `src/routes/orders-page.tsx` | Listado "Reservas y ventas" |

## Flujo e idempotencia

```
validar → INSERT orders (status=pending, ordenId = siguiente) → POST a Ninox
   ├─ facturaId > 0          → created (factura_id, response)
   ├─ facturaId 0 / 4xx      → failed (motivo de `datos` o del error)
   └─ timeout / error de red → unknown ("verificá en Ninox antes de reintentar")
```

- **ordenId:** `MAX(orden_id) + 1`, con una base configurable (`orders.ordenIdBase`) para no chocar con otra app que use el mismo token. Viaja también como `numero`.
- **Reintentos:** reintentar (`POST /orders/:id/retry`) reusa el **mismo** `ordenId`, así Ninox puede detectar el duplicado. `venta` tiene además una protección antiduplicado de 30 s por `ordenId`.
- **Reinicios:** si el proceso se corta con órdenes `pending`, al arrancar quedan como `unknown`.
- **Cancelar:** solo aplica a reservas `created`. Llama a `Pedido/cancelar?facturaid=` y exige `NxResultado.tipo === 1`.
- **Consultar comprobante:** `GET comprobante/{facturaId}` devuelve el estado actual en Ninox (bucket de 10 s en producción).

## Reglas del contrato

- `total = subtotal + envio + recargo - descuento`. El backend recalcula el subtotal desde las líneas.
- Hay que mandar `entidadId`, o `usuario` con `nombre` y al menos `dni`, `cuit` o `email`.
- En ventas, `medioPago.tipo` debe ser 1 (efectivo), 9 (depósito o transferencia, requiere `cuentaBancariaId`) u 11 (virtual).

## Extender

- **Nota de crédito:** agregar `notacredito` a `OrdersService` con `facturaRefId` (el tipo `kind` y la migración deben contemplarlo).
- **Vendedor:** agregar `empleadoId` al formulario, con los ids de `GET empleados`.
- **Facturar una reserva:** `POST facturar` con `facturaId`, `puntoVentaId`, `electronica` y `medioPago`.
