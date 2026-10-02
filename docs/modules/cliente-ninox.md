# Cliente Ninox y rate limits

## Propósito

Único punto de contacto con la API de terceros: autenticación, timeouts, traducción de errores y control de frecuencia.

## Código

| Archivo | Responsabilidad |
|---|---|
| `server/src/ninox/client.ts` | `NinoxClient`: un método por endpoint y un transporte común |
| `server/src/ninox/rate-limiter.ts` | `RateLimiter`: buckets persistidos en `api_rate_buckets` |
| `server/src/ninox/types.ts` | Contrato tipado (config, catálogo, comprobantes, exportaciones, stock, saldos) |
| `server/src/ninox/dates.ts` | Parseo de `dd/MM/yyyy HH:mm:ss` y utilidades de período `YYYY-MM` |
| `server/src/context.ts` | `ctx.ninox()` arma el cliente con la conexión vigente (settings o `.env`) |
| `server/src/modules/settings/` | Guarda entorno, URL, token y el snapshot de `GET /config` |

## Comportamiento del transporte

- **Headers:** el token viaja solo en `X-NX-TOKEN`; nunca en la URL.
- **Timeout y errores de red:** `NINOX_TIMEOUT_MS` (default 30 s) con `AbortController`. Sin respuesta HTTP se lanza `NinoxNetworkError` con `sent`:
  - `sent = false`: la request nunca llegó (conexión rechazada, DNS, certificado TLS no confiable). La API responde 502 con la causa, y un pedido queda `failed` (se puede reintentar sin riesgo).
  - `sent = true`: timeout (504) o corte a mitad de camino. Un pedido queda `unknown`.
- **TLS:** al arrancar, `server/src/lib/tls.ts` suma los certificados raíz del sistema a los de Node (`NINOX_USE_SYSTEM_CA=false` lo desactiva). Así una API local con certificado de desarrollo confiado en el SO funciona sin apagar la verificación TLS.
- **Errores HTTP:** lanzan `NinoxApiError(status, detalle)` con los primeros 300 caracteres del body.
- **403 por rate limit:** un 403 con "Debe esperar N segundos" penaliza el bucket con N segundos y lanza `RateLimitedError`.
- **Reintentos:** solo los GET de exportación y saldos, ante 5xx o error de red, con backoff de 1 s y 3 s. **Nunca** se reintenta un POST.
- **Log:** una línea por request (`[ninox] GET /ruta → 200 (123ms)`), sin query, body ni token.

## Rate limiter

Hay dos formas de pedir turno:

- `take(bucket)`: si la ventana está ocupada lanza `RateLimitedError` con los segundos restantes. La usan las acciones manuales (sync de catálogo, probar conexión, consultar comprobante), y la API responde 429 con `details.retryAfterSeconds`.
- `acquire(bucket, signal)`: espera a que se libere y después reserva. La usa la ingesta.

Detalles de las ventanas:

- Las ventanas dependen del entorno: `prod` usa los valores de producción, y `test` y `custom` los de testing. Cada una suma 1 s de margen.
- La ventana se reserva **antes** de llamar, así que una llamada fallida también la consume. Es conservador a propósito.
- En tests, el reloj y la espera se inyectan (`createContext(db, { limiter: { now, sleep } })`).

## Extender

1. Agregar el tipo en `types.ts` y el método en `client.ts`, con su `bucket`. Si el endpoint es nuevo, sumar el bucket en `WINDOWS_SECONDS`.
2. Llamarlo desde un servicio del módulo, nunca desde una ruta directamente.
3. Test con `createTestContext({ "GET /integraciones/terceros/...": () => ({ body }) })`.
