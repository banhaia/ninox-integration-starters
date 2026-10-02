# Getting started

Guía para dejar la app funcionando contra tu integración de terceros de Ninox.

## 1. Requisitos

- Node.js 22 (ver `.nvmrc`; mínimo 20.17).
- Un token de la **integración de terceros** (`X-NX-TOKEN`). Se pide en [ninoxnet.com/integraciones/terceros](https://www.ninoxnet.com/integraciones/terceros) o a dev@banhaia.com. Cada integración arranca con un análisis del caso y se desarrolla primero contra **testing**.

## 2. Instalar y levantar

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3030 (el frontend proxya `/api`)
- La base se crea sola en `./data/ninox-app.db`. Está en `.gitignore`.

## 3. Primer acceso

La primera vez que abrís la app te pide crear el usuario administrador: un nombre de usuario y una contraseña de al menos 6 caracteres. De ahí en más, ese usuario entra con login normal. Podés cambiar la contraseña en **Configuración**.

## 4. Conectar con Ninox

En **Configuración**:

1. Elegí el entorno:
   - **Testing**: `api.test-ninox.com.ar`.
   - **Producción**: `api.ninox.com.ar`.
   - **URL personalizada**: una API local o de staging.
2. Pegá el token y tocá **Guardar y probar**. La app llama a `GET /config` y muestra:
   - el nombre de la integración, el punto de venta y la lista de precios;
   - las **sucursales habilitadas para exportar**. Si no hay ninguna, las exportaciones responden 403 hasta que el administrador de Ninox las habilite en *Configuración › Canales*;
   - los depósitos.

Alternativa: definir `NINOX_TOKEN` y `NINOX_ENV` en un `.env` (ver `.env.example`).

## 5. Catálogo y stock

Desde **Inicio**, tocá **Sincronizar ahora**. La app descarga el catálogo completo (`GetData`) y lo guarda en SQLite. Después se actualiza sola cada 15 minutos.

Ninox permite una consulta de catálogo cada 10 minutos en producción (3 en testing). Si intentás antes, la app te dice cuántos segundos faltan en lugar de pegarle a Ninox.

En **Stock** buscás por código, nombre, categoría o código de barras, y filtrás por color y talle.

## 6. Reservas y ventas

En **Nueva operación**:

- **Crear reserva**: `POST Pedido`. Genera una preventa que reserva stock en Ninox.
- **Crear venta directa**: `POST venta`. Requiere medio de pago: efectivo, transferencia/depósito o virtual.

Sobre el pedido:

- El `ordenId` lo asigna la app y es la clave para no duplicar operaciones.
- Podés indicar un cliente existente con `entidadId`. Si no, completás nombre y al menos DNI, CUIT o email.

En **Reservas y ventas** ves todo lo enviado y podés:

- **Cancelar** una reserva.
- **Reintentar** una operación rechazada o sin confirmar (usa el mismo `ordenId`).
- **Consultar el comprobante** actual en Ninox.

## 7. Ingesta de datos

En **Ingesta** elegís la sucursal, un rango de meses y qué importar:

- Ventas · ítems
- Ventas · totales y medios de pago
- Compras · ítems
- Compras · totales y medios de pago

La app crea un job por mes y tipo, los procesa de a uno respetando el límite de Ninox (una página de 500 filas cada 30 s en producción) y muestra el progreso. Reimportar un mes **reemplaza** sus datos, nunca duplica.

Si el servidor se reinicia, los jobs retoman desde la última página descargada. Lo importado se puede descargar como CSV.

Stock por depósito y saldos de clientes y proveedores aparecen como *Próximamente*: el esquema y el código ya están preparados (ver [modules/ingesta.md](./modules/ingesta.md)).

## 8. Reportes

En **Reportes** elegís el mes y, si querés, la sucursal:

- **KPIs del mes contra el anterior**: ventas netas, comprobantes, ticket promedio, unidades, margen estimado y compras.
- **Gráficos**: ventas contra compras de los últimos 12 meses, ticket promedio, top 10 artículos y medios de pago.
- **Tabla** con el detalle mensual.

Los reportes leen solo la base local: para ver datos, primero ingestá esos meses.

## 9. Pasar a producción

1. Validá todo el flujo contra testing.
2. Cambiá el entorno a producción y cargá el token de producción.
3. `npm run build && NODE_ENV=production npm start`.
4. Creá el usuario **antes** de exponer la app a una red.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| "Falta configurar el token" | Cargalo en Configuración o en `.env` |
| 401 de Ninox | Token inválido o de otro entorno (test ≠ prod) |
| "Ninox limita esta consulta: esperá N segundos" | Rate limit. La app ya calcula la espera; la ingesta espera sola |
| Exportación con 403 | La integración no tiene sucursales habilitadas en Ninox |
| 422 al crear pedido | Los totales no cierran: `total = subtotal + envío + recargo − descuento` |
| 502 "El certificado HTTPS … no es de confianza" | API local con certificado autofirmado. La app usa los certificados del sistema: confiá el certificado de desarrollo (`dotnet dev-certs https --trust`, o el de IIS Express) y reiniciá `npm run dev` |
| 502 "No se pudo conectar … (ECONNREFUSED)" | La URL es incorrecta o la API no está levantada |
| 504 "Ninox no respondió en N s" | Timeout: la API tardó más que `NINOX_TIMEOUT_MS` |
| Operación "Sin confirmar" | Timeout o corte de red. Verificá en Ninox o consultá el comprobante antes de reintentar |
