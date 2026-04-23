# chatbot-ollama-app

## Propósito

Ejemplo full-stack de chatbot con Ollama y base de conocimiento editable. Además cachea stock de Ninox en JSON y agrega productos relevantes al contexto del modelo para responder disponibilidad, precios, talles y colores sin enviar todo el catálogo.

## Mapa de Código

### Backend

- `examples/chatbot-ollama-app/server/src/index.ts`: entrypoint Express, carga `.env`, monta router, sirve frontend compilado e inicializa sync de stock.
- `examples/chatbot-ollama-app/server/src/routes/api.ts`: endpoints de knowledge base, chat, conversaciones, status y stock.
- `examples/chatbot-ollama-app/server/src/services/knowledge-base-service.ts`: lee/escribe `data/knowledge-base.json` y provee valores por defecto.
- `examples/chatbot-ollama-app/server/src/services/conversation-service.ts`: persiste conversaciones en `data/conversations/`.
- `examples/chatbot-ollama-app/server/src/services/ollama-service.ts`: cliente HTTP para `/api/chat` de Ollama.
- `examples/chatbot-ollama-app/server/src/services/stock-container.ts`: instancia singleton del sync de stock.
- `examples/chatbot-ollama-app/server/src/services/stock-sync-service.ts`: ciclo de sync, estado y lectura normalizada de productos.
- `examples/chatbot-ollama-app/server/src/services/stock-repository.ts`: lee/escribe `data/stock-cache.json`.
- `examples/chatbot-ollama-app/server/src/services/stock-context-service.ts`: filtra productos relevantes para el mensaje y construye contexto compacto para Ollama.
- `examples/chatbot-ollama-app/server/src/services/stock-query-service.ts`: arma facetas, filas y filtros para la vista de stock visible.
- `examples/chatbot-ollama-app/server/src/sources/catalog-source.ts`: contrato de fuente de catálogo.
- `examples/chatbot-ollama-app/server/src/sources/ninox-catalog-source.ts`: fuente Ninox basada en `NinoxClient`.
- `examples/chatbot-ollama-app/server/src/types/index.ts`: tipos de knowledge base, conversación y mensajes Ollama.
- `examples/chatbot-ollama-app/server/src/types/stock.ts`: snapshot y estado de sync de stock.

### Frontend

- `examples/chatbot-ollama-app/src/app.tsx`: router React de la app.
- `examples/chatbot-ollama-app/src/lib/api.ts`: cliente fetch tipado para chat, knowledge base, conversaciones, status y stock.
- `examples/chatbot-ollama-app/src/routes/home-page.tsx`: pantalla inicial/resumen.
- `examples/chatbot-ollama-app/src/routes/knowledge-base-page.tsx`: edición de la base de conocimiento.
- `examples/chatbot-ollama-app/src/routes/stock-page.tsx`: vista filtrable del stock cacheado usando `@ninox/stock-ui`.
- `examples/chatbot-ollama-app/src/routes/chat-page.tsx`: interfaz de chat contra el backend.
- `examples/chatbot-ollama-app/src/routes/conversations-page.tsx`: listado y lectura de conversaciones guardadas.
- `examples/chatbot-ollama-app/src/components/layout-shell.tsx`: navegación y estructura visual.
- `examples/chatbot-ollama-app/src/components/ui/`: componentes UI base.

### Template Compartido

- `templates/node-typescript/src/client/ninoxClient.ts`: cliente HTTP para `GetData` y otros endpoints Ninox.
- `templates/node-typescript/src/services/productService.ts`: normalización de catálogo Ninox a `Product[]`.
- `templates/node-typescript/src/types/product.ts`: estructura de productos y variantes usada por el contexto de stock.

### UI Compartida

- `packages/stock-ui/src/stock-catalog-view.tsx`: componente React reutilizable para búsqueda, facetas y listado de stock.
- `packages/stock-ui/src/types.ts`: contrato frontend compartido (`ProductsPayload`, `StockRow`, filtros y facetas).

## Flujos Principales

- Knowledge base: `/api/knowledge-base` lee o guarda datos de empresa; si no existe JSON, se crea con defaults.
- Chat: `/api/chat` carga knowledge base, recupera o crea conversación, busca stock relevante, arma el system prompt y llama a Ollama.
- Contexto de stock: `stock-context-service.ts` extrae palabras útiles del mensaje, rankea productos del cache local y limita la cantidad con `STOCK_CONTEXT_MAX_PRODUCTS`.
- Vista de stock: `/stock` consume `/api/stock/products` y muestra el catálogo cacheado con filtros de texto, color y talle.
- Sync de stock: al iniciar el server, `stockSyncService.init()` lee snapshot local, sincroniza si está vacío y hay credenciales, y programa sync periódico.
- Conversaciones: cada respuesta guarda mensaje de usuario y respuesta del asistente en JSON.

## Endpoints

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/api/knowledge-base` | Leer base de conocimiento |
| POST | `/api/knowledge-base` | Guardar base de conocimiento |
| POST | `/api/chat` | Enviar mensaje a Ollama con contexto |
| GET | `/api/conversations` | Listar conversaciones |
| GET | `/api/conversations/:id` | Leer conversación |
| DELETE | `/api/conversations/:id` | Eliminar conversación |
| GET | `/api/status` | Estado general, Ollama y stock |
| GET | `/api/stock/status` | Estado del cache de stock |
| GET | `/api/stock/products` | Stock filtrado por `search`, `color`, `size` |
| POST | `/api/stock/sync` | Sync manual desde Ninox |

## Variables y Datos

- `PORT`: puerto Express; default 3031.
- `OLLAMA_BASE_URL`: URL del servidor Ollama; default local.
- `OLLAMA_MODEL`: modelo usado en `/api/chat`.
- `NINOX_BASE_URL`: base URL de Ninox.
- `NINOX_TOKEN`: token de terceros para header `X-NX-TOKEN`.
- `NINOX_TIMEOUT_MS`: timeout del cliente Ninox.
- `CATALOG_SYNC_INTERVAL_MS`: intervalo de sync; default 10 minutos.
- `STOCK_CONTEXT_MAX_PRODUCTS`: máximo de productos agregados al contexto.
- `examples/chatbot-ollama-app/data/knowledge-base.json`: base editable.
- `examples/chatbot-ollama-app/data/stock-cache.json`: snapshot local de stock.
- `examples/chatbot-ollama-app/data/conversations/`: historial de conversaciones.

## Puntos de Extensión

- Mejorar matching de stock: evolucionar `stock-context-service.ts` con embeddings, sinónimos o búsqueda por variantes.
- Extender la UI de stock: ampliar `stock-query-service.ts` y el contrato de `@ninox/stock-ui` si se necesitan nuevas facetas.
- Cambiar proveedor LLM: reemplazar `ollama-service.ts` manteniendo el contrato `OllamaMessage`.
- Agregar herramientas al bot: extender `/api/chat` para decidir acciones antes o después de llamar al modelo.
- Persistencia alternativa: reemplazar servicios JSON por base de datos manteniendo los contratos del router.

## Cuidados

- No enviar el catálogo completo a Ollama salvo que el catálogo sea chico y se acepte el costo de contexto.
- No inventar disponibilidad: el prompt de stock debe indicar que solo use productos incluidos en el contexto.
- No exponer `NINOX_TOKEN` al frontend.
- Respetar el límite de 10 minutos de Ninox para sync automático.
- Mantener el chatbot funcional aunque Ninox no esté configurado o falle el sync.
- Mantener imports NodeNext con extensión `.js` en archivos server.
