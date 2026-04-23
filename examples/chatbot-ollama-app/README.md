# Chatbot Ollama App

Chatbot conversacional con base de conocimiento personalizable, integrado con [Ollama](https://ollama.com/) (local o en la nube).

## Características

- **Base de conocimiento editable**: nombre de empresa, rubros, descripción de productos, quiénes somos, ubicaciones y system prompt.
- **Chat en tiempo real**: interfaz de chat que responde usando el contexto de tu empresa.
- **Historial persistente**: todas las conversaciones se guardan como JSON en disco.
- **Ollama flexible**: apunta a una instancia local (`http://localhost:11434`) o a un servidor remoto mediante variable de entorno.

## Configuración

Copiá `.env.example` a `.env` y ajustá los valores:

```env
PORT=3031
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

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
│   │   └── ollama-service.ts          # Cliente HTTP para Ollama
│   └── types/index.ts
├── src/
│   ├── routes/
│   │   ├── home-page.tsx
│   │   ├── knowledge-base-page.tsx
│   │   ├── chat-page.tsx
│   │   └── conversations-page.tsx
│   └── ...
└── data/                           # Generado en runtime
    ├── knowledge-base.json
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

## Ollama en la nube

Para apuntar a Ollama remoto, simplemente configurá:

```env
OLLAMA_BASE_URL=https://tu-ollama-server.com
OLLAMA_MODEL=llama3.1
```

Asegurate de que el servidor remoto tenga CORS habilitado o usá el proxy del backend (recomendado).
