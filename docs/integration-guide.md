# Guía técnica — Integración de terceros Ninox

Referencia técnica completa para desarrolladores y agentes AI. Para una guía paso a paso más amigable, ver [getting-started.md](./getting-started.md).

## Entornos

| Entorno    | Base URL                          | Uso                        |
|------------|-----------------------------------|----------------------------|
| Testing    | `https://api.test-ninox.com.ar`   | Desarrollo y validación    |
| Producción | `https://api.ninox.com.ar`        | Producción                 |

## Autenticación

Todas las requests requieren:

```
X-NX-TOKEN: {token}
Content-Type: application/json
```

El token se obtiene al contratar la integración de terceros. Contacto: dev@banhaia.com.

El token está asociado a un depósito y punto de venta específicos. Una app = un token = un depósito + un punto de venta.

## Endpoints de lectura

### GET /integraciones/Terceros/GetData

Retorna el catálogo completo agrupado por artículo. Cada artículo incluye sus variantes (curvas) como array interno.

Campos principales de cada artículo:
- Código, descripción
- Categorías (array)
- Etiquetas (array)
- Precios (principal y adicionales)
- Variantes con talle/color/combinación y stock por cada una

### GET /integraciones/Terceros/GetDataCurva

Retorna el catálogo en estructura plana: una entrada por cada variante. Útil cuando la app necesita trabajar directamente a nivel SKU sin agrupar.

### Restricción de frecuencia

Ambos endpoints tienen un **mínimo de 10 minutos entre consultas**. Si se consulta antes, el servidor responde `403 Forbidden`.

Estrategia recomendada: foto inicial + caché local + refresco periódico + webhooks opcionales.

## Endpoints de pedidos

### POST /integraciones/Terceros/Pedido

Crea un pedido en Ninox que genera una reserva de stock.

Validación obligatoria del payload:

```
total = subtotal + envio + recargo - descuento
```

Si los números no cierran, el endpoint rechaza el pedido con `422`.

El response incluye un `PedidoResultado` con el ID de la factura generada.

### POST /integraciones/Terceros/Pedido/cancelar

Cancela un pedido existente. Requiere `facturaid` (number) en el body. Retorna `NxResultado` con estado de la operación.

## Webhooks

Ninox puede notificar cambios en artículos mediante webhooks, lo que permite reducir polling y mantener el catálogo actualizado en tiempo casi real.

Documentación detallada en `data/integracion-de-terceros-webhooks.pdf`.

## Códigos de error

| Código | Causa                              | Acción                              |
|--------|------------------------------------|-------------------------------------|
| 401    | Token inválido o expirado          | Verificar header X-NX-TOKEN         |
| 403    | Consulta antes de 10 min           | Esperar y reintentar                |
| 400    | Request mal formada                | Revisar formato del payload         |
| 422    | Error de validación                | Verificar totales y campos requeridos |
| 404    | Recurso no encontrado              | Validar IDs                         |
| 500    | Error interno Ninox                | Reintentar con backoff              |

## Esquema de datos

El esquema completo del payload está documentado en `data/integracion-de-terceros-esquema-de-datos.pdf`. Los tipos TypeScript del template (`templates/node-typescript/src/types/product.ts`) modelan los campos principales.

Campos clave por artículo:

- **Identificación:** código interno, código de barras (si aplica)
- **Descripción:** nombre, descripción extendida
- **Clasificación:** categorías (jerárquicas), etiquetas (planas)
- **Precios:** precio principal, lista de precios adicional
- **Variantes:** combinaciones de talle/color con stock individual
- **Stock:** disponible por variante, calculado según el depósito del token

## Consideraciones de arquitectura

### Caché y persistencia

No consultar la API en cada request del usuario final. Implementar caché local con refresco periódico. Opciones según complejidad:

- JSON en disco (como hace `stock-dashboard-app`)
- SQLite para búsquedas más rápidas
- Redis/Memcached para alta concurrencia
- Base de datos relacional para integraciones complejas

### Seguridad del token

El token nunca debe llegar al frontend. Implementar siempre un backend o middleware que tenga el token en variables de entorno y exponga una API propia al frontend.

### Idempotencia en pedidos

Implementar control de duplicados antes de enviar pedidos. Un pedido duplicado genera una reserva duplicada en Ninox.

### Manejo de errores

Implementar retry con exponential backoff para errores 5xx. Para errores 4xx, no reintentar (corregir el request). Loguear todos los errores con contexto suficiente para diagnóstico.

## Referencia de archivos en este repo

| Archivo | Qué muestra |
|---------|-------------|
| `templates/node-typescript/src/client/ninoxClient.ts` | Cliente HTTP con auth y manejo de errores |
| `templates/node-typescript/src/services/productService.ts` | Normalización y búsqueda de productos |
| `templates/node-typescript/src/types/product.ts` | Tipos TypeScript del modelo |
| `examples/chatbot-stock/run.js` | Búsqueda por texto libre |
| `examples/ecommerce-sync/run.js` | Mapeo para storefront |
| `examples/create-order/run.js` | Placeholder de creación de pedido |
| `examples/stock-dashboard-app/` | App completa React + Express |
| `shared/sample-responses/` | Mocks para desarrollo offline |
| `shared/postman/` | Colección Postman para testing manual |
