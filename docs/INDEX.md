# Índice de documentación

| Documento | Para qué |
|---|---|
| [../ONBOARDING.md](../ONBOARDING.md) | Onboarding guiado para la IA que ayuda a alguien a empezar: copia propia, instalación y primer uso |
| [getting-started.md](./getting-started.md) | Guía paso a paso: instalar, configurar el token y usar cada módulo |
| [integration-guide.md](./integration-guide.md) | Referencia de la API de terceros de Ninox y decisiones técnicas de la app |
| [prompts.md](./prompts.md) | Prompts de ejemplo para pedirle a un agente AI que construya o extienda una integración |

## Módulos

| Módulo | Documento | Código |
|---|---|---|
| Acceso (login y autosetup) | [modules/auth.md](./modules/auth.md) | `server/src/auth/`, `server/src/modules/auth/` |
| Cliente Ninox y rate limits | [modules/cliente-ninox.md](./modules/cliente-ninox.md) | `server/src/ninox/` |
| Catálogo y stock | [modules/catalogo.md](./modules/catalogo.md) | `server/src/modules/catalog/` |
| Reservas y ventas | [modules/pedidos.md](./modules/pedidos.md) | `server/src/modules/orders/` |
| Ingesta de datos | [modules/ingesta.md](./modules/ingesta.md) | `server/src/modules/ingest/` |
| Reportes | [modules/reportes.md](./modules/reportes.md) | `server/src/modules/reports/` |
| Chatbot Ollama (ejemplo) | [modules/chatbot-ollama-app.md](./modules/chatbot-ollama-app.md) | `examples/chatbot-ollama-app/` |
