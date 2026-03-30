# node-typescript

Template base para integrar con Ninox desde Node.js + TypeScript.

## Incluye

- cliente HTTP con `getProducts()`
- placeholder `createOrder()`
- tipos para productos, variantes, categorias y tags
- normalizacion de payload
- busqueda por texto/codigo
- filtros por categoria y etiqueta

## Instalacion

```bash
npm install
cp .env.example .env
```

## Variables de entorno

```env
NINOX_BASE_URL=https://api.test-ninox.com.ar
NINOX_TOKEN=tu_token
NINOX_TIMEOUT_MS=10000
```

## Ejecutar

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Estructura

```text
src/
|-- client/
|   `-- ninoxClient.ts
|-- config/
|   `-- env.ts
|-- services/
|   `-- productService.ts
|-- types/
|   `-- product.ts
`-- index.ts
```

## Extension recomendada

- Ajustar `normalizeProducts()` si el payload real usa nombres distintos.
- Completar `createOrder()` cuando se confirme el endpoint y schema exacto del pedido.

