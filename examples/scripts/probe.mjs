// Inspecciona un endpoint GET real de la API de terceros para ver la forma de la respuesta.
// Uso:
//   node examples/scripts/probe.mjs /integraciones/terceros/config
//   node examples/scripts/probe.mjs "/integraciones/terceros/exportar/ventatotales/paginado?sucursalId=1&anio=2026&mes=03&pageSize=2"
//   node examples/scripts/probe.mjs /integraciones/terceros/config --shape   (solo claves y tipos, sin valores)
//
// Lee NINOX_TOKEN / NINOX_ENV / NINOX_BASE_URL del entorno o de .env. Solo hace GET.
// La salida puede contener datos reales: NO la pegues en fixtures, issues ni commits.
// Respetá los rate limits (ver docs/integration-guide.md): GetData y las exportaciones masivas
// admiten una consulta cada 10 minutos en producción.
import { ninoxGet } from "./ninox.mjs";

const [path, flag] = process.argv.slice(2);
if (!path?.startsWith("/")) {
  console.error('Uso: node examples/scripts/probe.mjs "/integraciones/terceros/<ruta>?<query>" [--shape]');
  process.exit(1);
}

function shape(value, depth = 0) {
  if (Array.isArray(value)) return value.length === 0 ? [] : [shape(value[0], depth + 1), `…${value.length} elementos`];
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, depth > 6 ? "…" : shape(v, depth + 1)]));
  }
  return value === null ? "null" : typeof value;
}

const result = await ninoxGet(path);
const output = flag === "--shape" ? shape(result) : result;
const text = JSON.stringify(output, null, 2);
console.log(text.length > 20000 ? `${text.slice(0, 20000)}\n… (truncado, ${text.length} caracteres)` : text);
