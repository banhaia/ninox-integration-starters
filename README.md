# ninox-integration-starters

Starter repo con templates y ejemplos para integrar sistemas externos con Ninox usando la integracion de terceros.

## Que incluye

- `templates/node-typescript`: cliente base en Node.js + TypeScript para leer catalogo y dejar preparado el envio de pedidos.
- `examples/chatbot-stock`: busqueda simple por texto para bots o asistentes.
- `examples/ecommerce-sync`: mapeo del catalogo Ninox a una estructura mas simple para storefronts.
- `examples/create-order`: payload base para dejar listo el flujo de pedidos.
- `examples/stock-dashboard-app`: app full-stack con React + Vite + Tailwind + Express para sincronizar y consultar stock.
- `shared/sample-responses`: respuestas de muestra para desarrollo local.
- `shared/postman`: coleccion y entorno de Postman.

## Que es la integracion de terceros de Ninox

Segun la documentacion incluida en `data/`, Ninox expone un endpoint GET para obtener articulos de una integracion:

`GET https://api.test-ninox.com.ar/integraciones/Terceros/GetData`

Autenticacion:

- header `X-NX-TOKEN`

La respuesta contiene productos con codigo, descripcion, categorias, etiquetas, precios, variantes y stock. La documentacion tambien menciona envio de pedidos para generar reservas; en este repo queda preparado como placeholder para completar cuando se confirme el contrato exacto del endpoint.

## Uso rapido

1. Instalar dependencias del monorepo:

```bash
npm install
```

2. Configurar variables:

```bash
cp examples/stock-dashboard-app/.env.example examples/stock-dashboard-app/.env
```

Completar:

```env
NINOX_BASE_URL=https://api.test-ninox.com.ar
NINOX_TOKEN=tu_token
```

3. Ejecutar la app full-stack desde la raiz:

```bash
npm run dev
```

Esto levanta backend + frontend y usa `templates/node-typescript` como libreria.

4. Compilar todo:

```bash
npm run build
```

5. Ejecutar ejemplos simples del template:

```bash
cd templates/node-typescript
node ../../examples/chatbot-stock/run.js remera negra
node ../../examples/ecommerce-sync/run.js
node ../../examples/create-order/run.js
```

## Casos de uso

- Chatbot con stock y catalogo.
- Ecommerce propio con sincronizacion de productos.
- Integracion con CRM o sistema externo.
- Automatizaciones comerciales.
- Dashboard operativo con cache local y sync manual/programado.

## Estructura

```text
.
|-- README.md
|-- templates/
|   `-- node-typescript/
|-- examples/
|   |-- chatbot-stock/
|   |-- ecommerce-sync/
|   |-- create-order/
|   `-- stock-dashboard-app/
`-- shared/
    |-- sample-responses/
    `-- postman/
```

## Notas

- El template usa `fetch` nativo de Node para evitar dependencias extra.
- La normalizacion es tolerante a variaciones comunes del payload para no acoplar el codigo a nombres exactos no confirmados.
- Si el endpoint real de pedidos usa otro path o schema, solo hay que completar `createOrder()` y ajustar el ejemplo `create-order`.
- La app de dashboard persiste un snapshot local del catalogo y deja preparada una capa de `sources` para sumar otros origenes mas adelante.
