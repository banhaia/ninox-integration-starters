# Chatbot Ollama App

Chatbot conversacional con base de conocimiento personalizable, integrado con [Ollama](https://ollama.com/) (local o en la nube).

## Características

- **Base de conocimiento editable**: nombre de empresa, rubros, descripción de productos, quiénes somos, ubicaciones y system prompt.
- **Chat en tiempo real**: interfaz de chat que responde usando el contexto de tu empresa.
- **Stock visible**: vista `/stock` con búsqueda, filtros de color/talle y datos del cache local.
- **Historial persistente**: todas las conversaciones se guardan como JSON en disco.
- **Ollama flexible**: apunta a una instancia local (`http://localhost:11434`) o a un servidor remoto mediante variable de entorno.

## Configuración

Copiá `.env.example` a `.env` y ajustá los valores:

```env
PORT=3031
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
CATALOG_SYNC_INTERVAL_MS=600000
NINOX_BASE_URL=https://api.test-ninox.com.ar
NINOX_TOKEN=
NINOX_TIMEOUT_MS=10000
STOCK_CONTEXT_MAX_PRODUCTS=8
```

## Stock Ninox

El backend puede sincronizar stock desde Ninox y guardarlo en `data/stock-cache.json`.
Al responder un chat, busca productos relevantes para el mensaje del usuario y agrega ese resumen al contexto de Ollama.

Endpoints:

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/stock/status` | Estado de sincronización y cantidad de productos cacheados |
| `GET` | `/api/stock/products` | Listado filtrable de stock para la vista `/stock` |
| `POST` | `/api/stock/sync` | Ejecuta una sincronización manual contra Ninox |

Si `NINOX_BASE_URL` o `NINOX_TOKEN` no están configurados, el chatbot sigue funcionando sin stock y el estado informa que no hay fuente configurada.

## Instalación y desarrollo

```bash
# Desde la raíz del monorepo
npm install

# Desarrollo con hot reload (frontend + backend)
npm run dev --workspace @ninox/chatbot-ollama-app

# Build para producción
npm run build --workspace @ninox/chatbot-ollama-app

# Correr el servidor compilado
npm run start --workspace @ninox/chatbot-ollama-app
```

## Estructura

```
chatbot-ollama-app/
├── server/src/
│   ├── index.ts                    # Express server
│   ├── routes/api.ts               # API endpoints
│   ├── services/
│   │   ├── knowledge-base-service.ts  # Lee/escribe knowledge-base.json
│   │   ├── conversation-service.ts    # Gestiona conversaciones en disco
│   │   ├── ollama-service.ts          # Cliente HTTP para Ollama
│   │   └── stock-query-service.ts     # Filas/facets para la vista de stock
│   └── types/index.ts
├── src/
│   ├── routes/
│   │   ├── home-page.tsx
│   │   ├── knowledge-base-page.tsx
│   │   ├── stock-page.tsx
│   │   ├── chat-page.tsx
│   │   └── conversations-page.tsx
│   └── ...
└── data/                           # Generado en runtime
    ├── knowledge-base.json
    ├── stock-cache.json
    └── conversations/
        └── conv_*.json
```

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/knowledge-base` | Obtener base de conocimiento |
| `POST` | `/api/knowledge-base` | Guardar base de conocimiento |
| `POST` | `/api/chat` | Enviar mensaje (body: `{ message, conversationId? }`) |
| `GET` | `/api/conversations` | Listar conversaciones |
| `GET` | `/api/conversations/:id` | Obtener conversación completa |
| `DELETE` | `/api/conversations/:id` | Eliminar conversación |
| `GET` | `/api/status` | Estado del servidor y configuración de Ollama |
| `GET` | `/api/stock/status` | Estado del cache local de stock |
| `GET` | `/api/stock/products` | Productos de stock con filtros `search`, `color` y `size` |
| `POST` | `/api/stock/sync` | Sincronizar stock desde Ninox |

## Ollama en la nube

Para apuntar a Ollama remoto, simplemente configurá:

```env
OLLAMA_BASE_URL=https://tu-ollama-server.com
OLLAMA_MODEL=llama3.1
```

Asegurate de que el servidor remoto tenga CORS habilitado o usá el proxy del backend (recomendado).
