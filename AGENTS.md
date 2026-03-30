# Repository Guidelines

> **Onboarding:** si es la primera vez que un agente trabaja con este repo, leer primero `CLAUDE.md` (metodología de 5 pasos, API reference, instrucciones de comportamiento). Para la guía de usuario, ver `docs/getting-started.md`. Para referencia técnica completa, `docs/integration-guide.md`.

## Project Structure & Module Organization
This repository is a small npm workspace centered on Ninox integration starters.

- `CLAUDE.md`: onboarding principal para agentes AI — metodología, API, restricciones y flujo de trabajo.
- `docs/getting-started.md`: guía paso a paso orientada al usuario final.
- `docs/integration-guide.md`: referencia técnica completa de la API y arquitectura.
- `templates/node-typescript/`: reusable Node.js + TypeScript client library (`src/client`, `src/services`, `src/types`, `src/config`).
- `examples/stock-dashboard-app/`: full-stack example with React + Vite frontend in `src/` and Express server in `server/src/`.
- `examples/chatbot-stock/`, `examples/ecommerce-sync/`, `examples/create-order/`: simple runnable scripts built on the template.
- `shared/sample-responses/`: local mock payloads for development.
- `shared/postman/`: Postman collection and environment.
- `data/`: PDFs con documentación oficial de Ninox (esquema de datos, webhooks, guía general).

## Build, Test, and Development Commands
Run commands from the repository root unless noted otherwise.

- `npm install`: install workspace dependencies.
- `npm run build`: build the template package and the stock dashboard app.
- `npm run dev`: build the shared template, then start the dashboard frontend and backend in watch mode.
- `npm run start`: build everything and run the dashboard server from compiled output.
- `node examples/chatbot-stock/run.js "remera negra"`: exercise the text-search example.
- `node examples/ecommerce-sync/run.js`: inspect the simplified ecommerce mapping.
- `node examples/create-order/run.js`: verify the placeholder order payload flow.

## Coding Style & Naming Conventions
Use TypeScript-first changes where possible. The repo uses `strict` TypeScript in both packages, so keep types explicit and avoid `any`.

- Indentation: 2 spaces.
- Strings: double quotes.
- File names: kebab-case for files (`catalog-sync-service.ts`, `stock-page.tsx`).
- Code symbols: `PascalCase` for classes/components, `camelCase` for functions, variables, and methods.
- Imports: keep them grouped and local-path based; preserve existing `.js` extensions in NodeNext server files.

## Testing Guidelines
There is no automated test suite configured yet. Validate changes by:

- running `npm run build` before opening a PR;
- running the relevant example script or `npm run dev` for UI/server changes;
- checking Ninox-backed flows with `.env` configuration or `shared/sample-responses/` when working offline.

If you add tests, place them beside the affected module or under a local `__tests__/` folder and keep the naming aligned with the target file.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commit subjects such as `Add stock dashboard app and improve Ninox mapping`. Follow that pattern.

- Keep commits focused and descriptive.
- In PRs, summarize the user-visible change, note any env/config updates, and list manual verification steps.
- Include screenshots only for frontend changes in `examples/stock-dashboard-app`.
