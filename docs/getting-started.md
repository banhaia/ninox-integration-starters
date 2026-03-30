# Getting Started

Guía paso a paso para crear tu integración con Ninox usando este repositorio como referencia. Funciona tanto si trabajás manualmente como si usás un agente AI (Claude Cowork, Codex, Cursor, etc.).

## Antes de empezar

### 1. Tener un token de integración

La integración de terceros de Ninox requiere un token (`X-NX-TOKEN`). Si no lo tenés, contactá a dev@banhaia.com o seguí el proceso en [ninoxnet.com/integraciones/terceros](https://www.ninoxnet.com/integraciones/terceros).

Mientras tanto, podés desarrollar usando los mocks de `shared/sample-responses/`.

### 2. Verificar requisitos técnicos

```bash
git --version
node --version   # v18+ recomendado para fetch nativo
npm --version
```

Si tu stack no es Node.js, no hay problema — la API de Ninox es REST estándar y funciona con cualquier lenguaje. Los ejemplos de este repo están en Node.js/TypeScript como referencia.

### 3. Clonar el repo

```bash
git clone https://github.com/banhaia/ninox-integration-starters.git
cd ninox-integration-starters
npm install
```

## Elegí tu escenario

La integración de terceros de Ninox cubre tres escenarios principales. Elegí el que más se acerque a tu caso:

### Ecommerce propio

Publicar catálogo desde Ninox y enviar pedidos de vuelta. Referencia: `examples/ecommerce-sync/` y `examples/stock-dashboard-app/`.

### Chatbot con stock

Consultar productos, precios y disponibilidad por texto. Referencia: `examples/chatbot-stock/`.

### Sistema externo

Sincronizar datos con CRM, ERP u otro sistema. Referencia: `templates/node-typescript/` como base.

## Los 5 pasos

La metodología de implementación sigue 5 pasos, alineados con el [asistente de Ninox](https://docs.ninox.com.ar/docs/integraciones/terceros):

### Paso 1 — Definir alcance

Respondé estas preguntas antes de escribir código:

- ¿Solo lectura de catálogo o también pedidos?
- ¿Stock en tiempo real o con caché?
- ¿Trabajás con variantes (talles, colores)?
- ¿Cuál es tu stack técnico?
- ¿Tenés el token de integración?

Una app de Ninox cubre un único depósito y punto de venta. Si necesitás más, serán integraciones separadas.

### Paso 2 — Traer catálogo

Primer request de prueba:

```bash
curl -s https://api.test-ninox.com.ar/integraciones/Terceros/GetData \
  -H "X-NX-TOKEN: TU_TOKEN" \
  -H "Content-Type: application/json" | head -c 500
```

Si usás el template de Node.js:

```bash
cd templates/node-typescript
cp .env.example .env
# Editá .env con tu token
node ../../examples/chatbot-stock/run.js "remera"
```

### Paso 3 — Normalizar datos

Mapeá la respuesta de Ninox al modelo de tu app. El template incluye un ejemplo de normalización en `templates/node-typescript/src/services/productService.ts` con tipos definidos en `src/types/product.ts`.

Campos típicos a mapear: código, descripción, categorías, etiquetas, precios, variantes, stock disponible.

### Paso 4 — Sincronizar cambios

La API tiene un límite de **10 minutos mínimo entre consultas**. Estrategia recomendada:

1. Foto inicial completa con `GetData`
2. Caché local (el ejemplo usa JSON en disco, pero podés usar DB)
3. Refresco periódico cada ≥10 minutos
4. Webhooks opcionales para cambios incrementales

Referencia de sync con caché: `examples/stock-dashboard-app/server/src/services/catalog-sync-service.ts`.

### Paso 5 — Enviar pedidos

Cuando tu flujo esté listo para generar ventas:

```
POST /integraciones/Terceros/Pedido
```

Validar antes de enviar: `total = subtotal + envio + recargo - descuento`. Referencia placeholder: `examples/create-order/run.js`.

## Usar con un agente AI

Si estás en Claude Cowork, Cursor u otro agente, el archivo `CLAUDE.md` en la raíz del repo contiene instrucciones específicas para que el agente te guíe paso a paso.

La forma más directa de arrancar es decirle al agente:

> "Quiero crear una integración con Ninox. Mi caso de uso es [ecommerce/chatbot/sync]. Mi stack es [tu stack]. Tengo/no tengo token."

El agente va a usar este repo como referencia y crear tu app en un directorio nuevo.

## Ejecutar los ejemplos

Desde la raíz del repo:

```bash
# App full-stack de ejemplo (frontend + backend)
npm run dev

# Scripts simples
node examples/chatbot-stock/run.js "remera negra"
node examples/ecommerce-sync/run.js
node examples/create-order/run.js
```

## Documentación adicional

- Documentación técnica completa: [docs.ninox.com.ar](https://docs.ninox.com.ar/docs/integraciones/terceros)
- Esquema de datos: `data/integracion-de-terceros-esquema-de-datos.pdf`
- Webhooks: `data/integracion-de-terceros-webhooks.pdf`
- Info comercial: [ninoxnet.com/integraciones/terceros](https://www.ninoxnet.com/integraciones/terceros)
