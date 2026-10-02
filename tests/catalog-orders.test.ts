import { describe, expect, it } from "vitest";
import { mapCatalog } from "../server/src/modules/catalog/mapper.js";
import { getSummary, listStockRows, replaceCatalog } from "../server/src/modules/catalog/repository.js";
import { CatalogSyncService } from "../server/src/modules/catalog/sync-service.js";
import { OrdersService } from "../server/src/modules/orders/service.js";
import { validateOrderBody } from "../server/src/modules/orders/validation.js";
import { RateLimitedError } from "../server/src/ninox/rate-limiter.js";
import type { NinoxArticulo } from "../server/src/ninox/types.js";
import { createTestContext, fixture } from "./helpers.js";

const catalogo = fixture<NinoxArticulo[]>("getData.sample.json");

describe("catálogo", () => {
  it("mapea GetData a artículos, variantes y tags", () => {
    const snapshot = mapCatalog(catalogo);
    expect(snapshot.articulos).toHaveLength(2);
    expect(snapshot.variantes).toHaveLength(3);
    expect(snapshot.tags.map((t) => t.nombre).sort()).toEqual(["Bazar", "Remeras", "Temporada Verano"]);
    expect(snapshot.articulos[0]).toMatchObject({ articulo_id: 1001, precio_venta: 15000, stock_total: 12 });
  });

  it("reemplaza el snapshot y marca eliminados los artículos que ya no vienen", () => {
    const { db } = createTestContext();
    replaceCatalog(db, mapCatalog(catalogo), "2026-03-01T00:00:00Z");
    expect(getSummary(db)).toMatchObject({ totalProducts: 2, totalVariants: 3, outOfStockProducts: 1, availableColors: 2 });

    replaceCatalog(db, mapCatalog([catalogo[0]]), "2026-03-02T00:00:00Z");
    expect(getSummary(db).totalProducts).toBe(1);
    const eliminado = db.prepare("SELECT eliminado FROM articulos WHERE articulo_id = 1002").get() as { eliminado: number };
    expect(eliminado.eliminado).toBe(1);
  });

  it("filtra por texto, categoría y color", () => {
    const { db } = createTestContext();
    replaceCatalog(db, mapCatalog(catalogo), "2026-03-01T00:00:00Z");
    expect(listStockRows(db, { search: "remera" }).total).toBe(1);
    expect(listStockRows(db, { search: "bazar" }).items[0].code).toBe("TAZ-010");
    const negro = listStockRows(db, { color: "negro" });
    expect(negro.total).toBe(1);
    expect(negro.items[0].variants).toHaveLength(3);
    expect(negro.items[0].categories).toEqual(["Remeras"]);
  });

  it("el sync manual respeta la ventana de 10 minutos entre llamadas", async () => {
    const { ctx, connect, calls } = createTestContext({
      "GET /integraciones/Terceros/GetData": () => ({ body: catalogo })
    });
    connect();
    const sync = new CatalogSyncService(ctx, 15);
    await expect(sync.sync("manual")).resolves.toEqual({ articulos: 2 });
    await expect(sync.sync("manual")).rejects.toBeInstanceOf(RateLimitedError);
    expect(calls.filter((c) => c.path.endsWith("GetData"))).toHaveLength(1);
    expect(sync.status().lastSyncAt).not.toBeNull();
  });
});

const pedidoValido = {
  usuario: { nombre: "Cliente Ejemplo", email: "ejemplo@example.com", dni: "", cuit: "", telefono: "", condicion: 1 },
  productos: [{ articuloId: 1001, precio: 15000, cantidad: 2 }],
  descuento: 1000,
  envio: 500,
  recargo: 0,
  total: 29500
};

describe("validación de pedidos", () => {
  it("valida la identidad total = subtotal + envío + recargo - descuento", () => {
    expect(validateOrderBody(pedidoValido, "preventa").payload?.subtotal).toBe(30000);
    expect(validateOrderBody({ ...pedidoValido, total: 30000 }, "preventa").errors.total).toBeDefined();
  });

  it("acepta entidadId en lugar de datos del cliente", () => {
    const { errors, payload } = validateOrderBody({ ...pedidoValido, usuario: undefined, entidadId: 77 }, "preventa");
    expect(errors).toEqual({});
    expect(payload?.entidadId).toBe(77);
    expect(payload?.usuario).toBeUndefined();
  });

  it("exige medio de pago soportado en ventas", () => {
    expect(validateOrderBody(pedidoValido, "venta").errors.medioPago).toBeDefined();
    expect(validateOrderBody({ ...pedidoValido, medioPago: { tipo: 1 } }, "venta").errors).toEqual({});
  });
});

describe("reservas y ventas", () => {
  it("asigna ordenId, registra la reserva y la cancela", async () => {
    const { ctx, connect, calls } = createTestContext({
      "POST /integraciones/Terceros/Pedido": (call) => ({
        body: { facturaId: 9001, numero: (call.body as { numero: number }).numero, errores: false }
      }),
      "POST /integraciones/Terceros/Pedido/cancelar": () => ({ body: { tipo: 1, mensajes: ["ok"] } })
    });
    connect();
    const service = new OrdersService(ctx);

    const order = await service.create("preventa", pedidoValido, 1);
    expect(order).toMatchObject({ status: "created", ordenId: 1, facturaId: 9001 });
    expect((calls[0].body as { ordenId: number }).ordenId).toBe(1);

    const cancelled = await service.cancel(order.id);
    expect(cancelled.status).toBe("cancelled");
    expect(calls[1].query.get("facturaid")).toBe("9001");
    expect(service.nextOrdenId()).toBe(2);
  });

  it("un timeout deja la orden 'unknown' y el reintento reutiliza el mismo ordenId", async () => {
    let fail = true;
    const { ctx, connect, calls } = createTestContext({
      "POST /integraciones/terceros/venta": () => {
        if (fail) return new Error("socket hang up");
        return { body: { facturaId: 9100 } };
      }
    });
    connect();
    const service = new OrdersService(ctx);

    const order = await service.create("venta", { ...pedidoValido, medioPago: { tipo: 1 } }, 1);
    expect(order.status).toBe("unknown");

    fail = false;
    const retried = await service.retry(order.id);
    expect(retried).toMatchObject({ status: "created", facturaId: 9100, ordenId: order.ordenId });
    expect(calls.map((c) => (c.body as { ordenId: number }).ordenId)).toEqual([order.ordenId, order.ordenId]);
  });

  it("si la request nunca llegó (conexión rechazada o certificado inválido) la orden queda rechazada, no desconocida", async () => {
    const refused = (code: string) => Object.assign(new TypeError("fetch failed"), { cause: { code } });
    const { ctx, connect } = createTestContext({
      "POST /integraciones/Terceros/Pedido": () => refused("ECONNREFUSED"),
      "GET /integraciones/terceros/config": () => refused("DEPTH_ZERO_SELF_SIGNED_CERT")
    });
    connect();

    const order = await new OrdersService(ctx).create("preventa", pedidoValido, 1);
    expect(order.status).toBe("failed");
    expect(order.error).toMatch(/ECONNREFUSED/);

    await expect(ctx.ninox().getConfig()).rejects.toMatchObject({ sent: false, message: expect.stringMatching(/certificado/) });
  });

  it("una respuesta sin facturaId queda como rechazada con el motivo de Ninox", async () => {
    const { ctx, connect } = createTestContext({
      "POST /integraciones/Terceros/Pedido": () => ({ body: { facturaId: 0, datos: { error: "Artículo sin stock" } } })
    });
    connect();
    const order = await new OrdersService(ctx).create("preventa", pedidoValido, 1);
    expect(order).toMatchObject({ status: "failed", error: "Artículo sin stock" });
  });
});
