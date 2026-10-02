# Repository Guidelines

> **¿La persona recién llega?** Si te pidió empezar, todavía no tiene su propia copia del proyecto o nunca levantó la app, seguí primero [`ONBOARDING.md`](ONBOARDING.md): onboarding guiado, sin asumir sistema operativo ni herramienta.
>
> **Playbook de integración con Ninox:** `.claude/agents/ninox-integration-expert.md`. Aunque tu herramienta no sea Claude Code, seguí esas instrucciones para cualquier tarea que toque la API de Ninox: fuentes oficiales, reglas del contrato, forma de trabajo, cómo probar con un token real y reglas de seguridad.
>
> Leer primero `CLAUDE.md`: arquitectura, modelo de datos, rutas, reglas de la API de Ninox y reglas de repo público. Guía de usuario: `docs/getting-started.md`. Índice de docs: `docs/INDEX.md`.

## Estructura

- `server/src/`: backend Express + SQLite (`db/`, `auth/`, `ninox/`, `modules/<modulo>/`).
- `src/`: frontend React + Vite (`routes/`, `components/`, `lib/`).
- `tests/`: Vitest (SQLite en memoria, fetch de Ninox simulado).
- `shared/sample-responses/`: fixtures **ficticias** con la forma real del contrato. `shared/postman/`: colección.
- `examples/`: material secundario y autocontenido (`chatbot-ollama-app/`, `scripts/*.mjs`).
- `docs/`: guías y documentación por módulo.
- `data/`: directorio de runtime (base SQLite). Está en `.gitignore`: nunca se commitea.

## Comandos

- `npm run dev`: backend + frontend en modo watch.
- `npm run validate`: typecheck + tests + build + chequeo de archivos sensibles. Correrlo antes de cada commit/PR.
- `npm test`, `npm run typecheck`, `npm run build`.

## Estilo

- TypeScript estricto, sin `any`. 2 espacios, comillas dobles, archivos kebab-case, `PascalCase` para componentes/clases y `camelCase` para funciones.
- Imports del backend con extensión `.js` (NodeNext). Alias `@/` en el frontend.
- Esquema de base: solo migraciones nuevas al final de `server/src/db/migrations.ts`; nunca editar una ya publicada.
- Escrituras múltiples dentro de `db.transaction()`.
- Nunca loguear el token, bodies de requests ni datos personales.
- UI y mensajes en español.

## Tests

- Cada cambio de backend lleva test en `tests/` usando `createTestContext()` de `tests/helpers.ts` (base en memoria, fetch simulado, reloj falso para el rate limiter).
- No usar datos reales en fixtures: inventarlos.

## Seguridad (repo público)

- No commitear `.env`, `data/`, `*.db`, logs, capturas con datos reales ni respuestas reales de Ninox.
- CI corre gitleaks sobre todo el historial; `npm run validate` falla si hay archivos sensibles trackeados.

## Commits y PRs

- Asuntos cortos en imperativo (`Add ingest runner for sales exports`).
- En el PR: qué cambia para el usuario, cambios de configuración/migraciones y cómo se verificó.
