import { describe, expect, it } from "vitest";
import { IngestRunner } from "../server/src/modules/ingest/runner.js";
import { getMonthly, getPaymentMethods, getTopProducts } from "../server/src/modules/reports/service.js";
import type { NinoxPaginado, NinoxVentaItem } from "../server/src/ninox/types.js";
import { createTestContext, fixture } from "./helpers.js";

const ventaItems = fixture<NinoxPaginado<NinoxVentaItem>>("ventaitems-paginado.sample.json");
const ventaTotales = fixture<NinoxPaginado<unknown>>("ventatotales-paginado.sample.json");

/** Parte la fixture de ítems en páginas de una fila para probar la paginación. */
function pagedItems(page: number): NinoxPaginado<NinoxVentaItem> {
  const items = ventaItems.items.slice(page - 1, page);
  return { items, totalRegistros: ventaItems.items.length, totalPaginas: ventaItems.items.length, paginaActual: page, pageSize: 1 };
}

function setup() {
  const test = createTestContext({
    "GET /integraciones/terceros/exportar/ventaitems/paginado": (call) => ({ body: pagedItems(Number(call.query.get("page"))) }),
    "GET /integraciones/terceros/exportar/ventatotales/paginado": () => ({ body: ventaTotales }),
    "GET /integraciones/terceros/exportar/compratotales/paginado": () => ({
      body: {
        items: [
          { facturaId: 7001, comprobanteTipo: 1, fechaText: "2026-03-02", sucursalId: 1, sucursal: "Casa Central", proveedor: "Proveedor Ejemplo", subTotal: 20000, total: 20000, descuento: 0, recargo: 0, iva: 0, impuestosTotal: 0, cantidad: 10 }
        ],
        totalRegistros: 1,
        totalPaginas: 1,
        paginaActual: 1,
        pageSize: 500
      }
    })
  });
  test.connect();
  return { ...test, runner: new IngestRunner(test.ctx) };
}

const count = (db: ReturnType<typeof setup>["db"], table: string): number =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

describe("ingesta", () => {
  it("pagina, guarda y reimportar el mismo mes no duplica filas", async () => {
    const { db, runner, calls } = setup();

    runner.enqueue("ventas_items", { sucursalId: 1, periodo: "2026-03" }, 1);
    runner.enqueue("ventas_totales", { sucursalId: 1, periodo: "2026-03" }, 1);
    await runner.drain();

    const jobs = runner.list();
    expect(jobs.every((job) => job.status === "done")).toBe(true);
    expect(count(db, "ventas_items")).toBe(2);
    expect(count(db, "ventas_totales")).toBe(2);
    expect(count(db, "ventas_formas_pago")).toBe(2);

    const itemCalls = calls.filter((c) => c.path.endsWith("ventaitems/paginado"));
    expect(itemCalls.map((c) => c.query.get("page"))).toEqual(["1", "2"]);
    expect(itemCalls[0].query.get("anio")).toBe("2026");
    expect(itemCalls[0].query.get("mes")).toBe("03");
    expect(itemCalls[0].query.get("sucursalId")).toBe("1");

    runner.enqueue("ventas_items", { sucursalId: 1, periodo: "2026-03" }, 1);
    runner.enqueue("ventas_totales", { sucursalId: 1, periodo: "2026-03" }, 1);
    await runner.drain();
    expect(count(db, "ventas_items")).toBe(2);
    expect(count(db, "ventas_totales")).toBe(2);
    expect(count(db, "ingest_staging")).toBe(0);

    const row = db.prepare("SELECT fecha, fecha_text, periodo FROM ventas_items LIMIT 1").get();
    expect(row).toEqual({ fecha: "2026-03-05T14:20:00.000Z", fecha_text: "2026-03-05", periodo: "2026-03" });
  });

  it("un error deja el job fallido y el reintento retoma", async () => {
    let fail = true;
    const test = createTestContext({
      "GET /integraciones/terceros/exportar/ventaitems/paginado": (call) =>
        fail && call.query.get("page") === "2" ? { status: 400, body: "error" } : { body: pagedItems(Number(call.query.get("page"))) }
    });
    test.connect();
    const runner = new IngestRunner(test.ctx);

    const job = runner.enqueue("ventas_items", { sucursalId: 1, periodo: "2026-03" }, 1);
    await runner.drain();
    expect(runner.get(job.id)).toMatchObject({ status: "failed", page: 1 });

    fail = false;
    runner.retry(job.id);
    await runner.drain();
    expect(runner.get(job.id)).toMatchObject({ status: "done", rows: 2 });
    const pages = test.calls.map((c) => c.query.get("page"));
    expect(pages).toEqual(["1", "2", "2"]);
  });

  it("no acepta tipos preparados todavía no habilitados", () => {
    const { runner } = setup();
    expect(() => runner.enqueue("stock", { depositoId: 1 }, 1)).toThrow(/no disponible/);
  });
});

describe("reportes", () => {
  it("calcula indicadores mensuales, top de artículos y medios de pago", async () => {
    const { db, runner } = setup();
    runner.enqueue("ventas_items", { sucursalId: 1, periodo: "2026-03" }, 1);
    runner.enqueue("ventas_totales", { sucursalId: 1, periodo: "2026-03" }, 1);
    runner.enqueue("compras_totales", { sucursalId: 1, periodo: "2026-03" }, 1);
    await runner.drain();

    const [febrero, marzo] = getMonthly(db, "2026-02", "2026-03");
    expect(febrero).toMatchObject({ periodo: "2026-02", ventasNetas: 0, comprobantes: 0 });
    expect(marzo).toMatchObject({
      ventasBrutas: 34500,
      notasCredito: 4500,
      ventasNetas: 30000,
      comprobantes: 1,
      ticketPromedio: 34500,
      unidades: 3,
      ventasItems: 34500,
      costo: 14000,
      margenBruto: 20500,
      comprasNetas: 20000,
      comprobantesCompra: 1
    });

    expect(getTopProducts(db, "2026-03")[0]).toEqual({ codigo: "REM-001", descripcion: "Remera Básica", unidades: 2, importe: 30000 });
    expect(getPaymentMethods(db, "2026-03")).toEqual([{ tipo: 1, medio: "Efectivo", importe: 30000 }]);
    expect(getMonthly(db, "2026-03", "2026-03", { sucursalId: 99 })[0].ventasNetas).toBe(0);
  });
});
