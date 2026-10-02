// Busca artículos por texto en el catálogo de Ninox (GetData) e imprime stock y variantes.
// Uso: NINOX_TOKEN=... node examples/scripts/chatbot-stock.mjs "remera negra"
// Recordá: GetData admite una consulta cada 10 minutos en producción.
import { ninoxGet } from "./ninox.mjs";

const query = process.argv.slice(2).join(" ").trim().toLowerCase();
if (!query) {
  console.error('Uso: node examples/scripts/chatbot-stock.mjs "texto a buscar"');
  process.exit(1);
}

const articulos = await ninoxGet("/integraciones/Terceros/GetData");
const matches = articulos
  .filter((a) =>
    [a.codigo, a.nombre, a.descripcion, ...(a.tags ?? []).map((t) => t.tagNombre)].join(" ").toLowerCase().includes(query)
  )
  .slice(0, 5);

if (matches.length === 0) console.log(`Sin resultados para "${query}"`);
for (const a of matches) {
  console.log(
    JSON.stringify(
      {
        articuloId: a.articuloId,
        codigo: a.codigo,
        nombre: a.nombre ?? a.descripcion,
        precio: a.precioVenta ?? a.precio1,
        stock: a.stockTotal,
        variantes: (a.curva ?? []).map((v) => ({ color: v.colorNombre, talle: v.talleNombre, unidades: v.unidades }))
      },
      null,
      2
    )
  );
}
