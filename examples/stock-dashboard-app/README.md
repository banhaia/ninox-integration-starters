# stock-dashboard-app

Ejemplo full-stack para listar stock de Ninox con cache local, sync manual y sync programado cada 10 minutos.

## Stack

- TypeScript
- Vite
- React
- Tailwind CSS
- componentes estilo shadcn
- Express

## Flujo

1. El backend sirve la API y, en build productivo, tambien el frontend.
2. El backend sincroniza el catalogo desde Ninox y guarda un snapshot local.
3. El frontend consume siempre la API local.
4. La capa de `sources` queda lista para sumar otros origenes de datos.

## Ejecutar desde raiz

```bash
npm install
cp examples/stock-dashboard-app/.env.example examples/stock-dashboard-app/.env
npm run dev
```
