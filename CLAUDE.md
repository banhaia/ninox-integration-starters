# Ninox Integration Starters — Onboarding para agentes AI

Este archivo está pensado para que un agente AI (Claude Cowork, Claude Code, Codex, Cursor, etc.) entienda el proyecto y guíe al usuario paso a paso en la construcción de su integración con Ninox.

## Qué es este repositorio

Un starter kit con ejemplos y templates para integrar sistemas externos con **Ninox ERP** usando la [integración de terceros](https://www.ninoxnet.com/integraciones/terceros). El objetivo es que el usuario clone este repo, entienda la metodología y cree su propia app con ayuda de un agente.

## Contexto de negocio

La integración de terceros de Ninox permite a aplicaciones externas:

- Leer catálogo completo (artículos, precios, variantes, stock, categorías, etiquetas)
- Enviar pedidos que generan reservas en Ninox
- Recibir webhooks de cambios en artículos

Casos de uso principales: ecommerce propio, chatbot con stock, sincronización con CRM/ERP externo, automatizaciones comerciales.

## Restricciones importantes

- **Una app = un depósito + un punto de venta** en Ninox. Múltiples depósitos requieren integraciones separadas.
- **Frecuencia mínima de consulta al catálogo: 10 minutos.** Si se consulta antes, responde `403 Forbidden`.
- **El token (`X-NX-TOKEN`) debe protegerse en backend**, nunca exponerlo en frontend.
- **El usuario necesita un token activo** de la integración de terceros. Si no lo tiene, debe contactar a dev@banhaia.com o seguir el proceso en ninoxnet.com/integraciones/terceros.

## API Reference rápida

### Entornos

| Entorno    | Base URL                            |
|------------|-------------------------------------|
| Testing    | `https://api.test-ninox.com.ar`     |
| Producción | `https://api.ninox.com.ar`          |

### Headers requeridos

```
X-NX-TOKEN: {token}
Content-Type: application/json
```

### Endpoints

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/integraciones/Terceros/GetData` | Catálogo agrupado por artículo y curva |
| GET | `/integraciones/Terceros/GetDataCurva` | Catálogo plano por variante |
| POST | `/integraciones/Terceros/Pedido` | Crear pedido (genera reserva) |
| POST | `/integraciones/Terceros/Pedido/cancelar` | Cancelar pedido por `facturaid` |

### Códigos de error frecuentes

- `401`: Token inválido o expirado
- `403`: Consulta antes de los 10 minutos permitidos
- `400`/`422`: Payload inválido o error de validación
- `500`: Error interno, reintentar

## Metodología de implementación (5 pasos)

Esta es la metodología oficial del [asistente de Ninox](https://docs.ninox.com.ar/docs/integraciones/terceros). Cuando el usuario pida ayuda, seguí estos pasos en orden:

### Paso 1 — Definir alcance

Antes de escribir código, confirmar con el usuario:

- ¿Solo lectura de catálogo o también envío de pedidos?
- ¿Necesita stock en tiempo real o alcanza con caché?
- ¿Trabaja con variantes (curvas/talles/colores)?
- ¿Qué stack usa? (este repo tiene ejemplos en Node.js/TypeScript, pero la API es REST estándar)
- ¿Tiene el token de integración?

**Entregable:** Definición clara del caso de uso (ecommerce, chatbot, sync externo).

### Paso 2 — Traer catálogo

Consumir `GetData` o `GetDataCurva` y verificar que la respuesta llega correctamente.

- Usar `shared/sample-responses/` para desarrollo offline si no hay token aún
- Referencia de cliente HTTP: `templates/node-typescript/src/client/ninoxClient.ts`
- Ejemplo funcional: `examples/chatbot-stock/run.js`

**Entregable:** Conexión verificada con el endpoint, respuesta parseada.

### Paso 3 — Normalizar datos

Mapear la respuesta de Ninox al modelo de datos de la app del usuario:

- Artículos → productos con código, descripción, imágenes
- Variantes → talles, colores, combinaciones
- Precios → precio principal y adicionales
- Stock → disponible por artículo o variante
- Categorías y etiquetas

Referencia de normalización: `templates/node-typescript/src/services/productService.ts` y `templates/node-typescript/src/types/product.ts`.

**Entregable:** Modelo de datos local definido, mapper implementado.

### Paso 4 — Sincronizar cambios

Definir estrategia de actualización:

- **Foto inicial completa** con `GetData`
- **Caché local** (JSON, SQLite, Redis, lo que aplique al stack)
- **Refresco periódico** cada ≥10 minutos
- **Webhooks** opcionales para cambios incrementales (ver `data/integracion-de-terceros-webhooks.pdf`)

Referencia de sync con caché: `examples/stock-dashboard-app/server/src/services/catalog-sync-service.ts`.

**Entregable:** Estrategia de sync implementada, caché funcionando.

### Paso 5 — Enviar pedidos

Implementar el flujo de creación de pedidos:

- Validar `total = subtotal + envio + recargo - descuento` antes de enviar
- Manejar errores y reintentos
- Considerar idempotencia (no duplicar pedidos)
- Placeholder de referencia: `examples/create-order/run.js`

**Entregable:** Flujo de pedido funcionando contra testing.

## Estructura del repositorio

```
.
├── CLAUDE.md              ← Este archivo (onboarding para agentes)
├── AGENTS.md              ← Convenciones de código y desarrollo
├── README.md              ← Descripción general del repo
├── docs/
│   ├── getting-started.md ← Guía paso a paso para usuarios
│   └── integration-guide.md ← Referencia técnica completa
├── templates/
│   └── node-typescript/   ← Cliente base reutilizable
├── examples/
│   ├── chatbot-stock/     ← Búsqueda de productos por texto
│   ├── ecommerce-sync/    ← Mapeo de catálogo para storefronts
│   ├── create-order/      ← Placeholder de envío de pedidos
│   └── stock-dashboard-app/ ← App full-stack de referencia
├── shared/
│   ├── sample-responses/  ← Payloads mock para desarrollo offline
│   └── postman/           ← Colección Postman
└── data/                  ← PDFs con documentación técnica de Ninox
```

## Cómo debe actuar el agente

### Si el usuario quiere crear una app nueva

1. Hacerle las preguntas del Paso 1 (alcance)
2. Crear la app en un directorio NUEVO, no dentro de este repo
3. Usar este repo solo como referencia de patrones y arquitectura
4. Seguir los 5 pasos en orden, mostrando progreso al usuario
5. El stack no tiene que ser Node.js — la API es REST, sirve cualquier lenguaje

### Si el usuario quiere entender cómo funciona

1. Dirigirlo a `docs/getting-started.md`
2. Mostrarle el ejemplo más cercano a su caso de uso
3. Explicar la metodología de 5 pasos

### Si el usuario quiere modificar un ejemplo existente

1. Trabajar directamente sobre el ejemplo relevante
2. Respetar las convenciones de `AGENTS.md`
3. Verificar que compila (`npm run build`)

### Si el usuario no tiene token

- Explicar que necesita contactar a Ninox para obtener credenciales de integración de terceros
- Contacto: dev@banhaia.com
- Mientras tanto, puede desarrollar usando `shared/sample-responses/` como mock
- Más info del proceso: https://www.ninoxnet.com/integraciones/terceros

## Documentación externa

- Documentación técnica completa: https://docs.ninox.com.ar/docs/integraciones/terceros
- Info comercial y proceso de alta: https://www.ninoxnet.com/integraciones/terceros
- Contacto técnico: dev@banhaia.com

## Notas para el agente

- Los PDFs en `data/` contienen la documentación oficial de Ninox (esquema de datos, webhooks, guía general). Consultalos si necesitás detalles del payload exacto.
- El archivo `data/ninox_getting_started_integracion_terceros.md` tiene prompts de ejemplo que pueden servir como referencia pero este `CLAUDE.md` los reemplaza como punto de entrada.
- Si el usuario menciona "Tienda Nube" o "WordPress", esos son integraciones nativas de Ninox y no usan este flujo de terceros. Redirigir a la documentación correspondiente en ninoxnet.com.
