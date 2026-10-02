// Crea una reserva (preventa) con POST /integraciones/Terceros/Pedido. Usar SOLO contra testing.
// Uso: NINOX_TOKEN=... node examples/scripts/create-order.mjs <articuloId> [precio]
//
// Reglas del contrato:
// - total = subtotal + envio + recargo - descuento (si no, 422).
// - usuario con al menos dni, cuit o email, o bien un entidadId existente.
// - ordenId único y estable: reintentar con el mismo ordenId evita duplicados.
import { ninoxPost } from "./ninox.mjs";

const articuloId = Number(process.argv[2]);
const precio = Number(process.argv[3] ?? 1000);
if (!articuloId) {
  console.error("Uso: node examples/scripts/create-order.mjs <articuloId> [precio]");
  process.exit(1);
}

const ordenId = Math.floor(Date.now() / 1000); // en una app real, una secuencia propia persistida
const subtotal = precio;
const pedido = {
  ordenId,
  numero: ordenId,
  detalle: "Pedido de prueba desde examples/scripts",
  usuario: { nombre: "Cliente Ejemplo", email: "ejemplo@example.com", dni: "", cuit: "", telefono: "", condicion: 1 },
  productos: [{ articuloId, precio, cantidad: 1 }],
  subtotal,
  descuento: 0,
  envio: 0,
  recargo: 0,
  total: subtotal
};

const result = await ninoxPost("/integraciones/Terceros/Pedido", pedido);
if (result?.facturaId > 0) {
  console.log(`Reserva creada: facturaId ${result.facturaId} (ordenId ${ordenId})`);
} else {
  console.error("Ninox no creó la reserva:", result?.datos ?? result);
  process.exit(1);
}
