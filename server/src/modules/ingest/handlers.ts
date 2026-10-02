import type { Db } from "../../db/connection.js";
import type { CallOptions, NinoxClient } from "../../ninox/client.js";
import { toIsoOrNull } from "../../ninox/dates.js";
import type { RateBucket } from "../../ninox/rate-limiter.js";
import type {
  ExportKind,
  NinoxCompraItem,
  NinoxCompraTotal,
  NinoxFormaPago,
  NinoxSaldoItem,
  NinoxStockItem,
  NinoxVentaItem,
  NinoxVentaTotal
} from "../../ninox/types.js";

export type IngestType =
  | "ventas_items"
  | "ventas_totales"
  | "compras_items"
  | "compras_totales"
  | "stock"
  | "saldos_clientes"
  | "saldos_proveedores";

export interface IngestJobParams {
  sucursalId?: number;
  /** 'YYYY-MM' para exportaciones de comprobantes. */
  periodo?: string;
  depositoId?: number;
}

export interface IngestJob {
  id: number;
  type: IngestType;
  params: IngestJobParams;
}

export interface PageResult {
  items: unknown[];
  totalPages: number;
}

export interface IngestHandler {
  type: IngestType;
  label: string;
  group: "ventas" | "compras" | "stock" | "saldos";
  /** Los handlers deshabilitados están preparados (tablas, cliente, mapper) pero no se exponen en la UI. */
  enabled: boolean;
  bucket: RateBucket;
  /** Qué parámetros necesita el job. */
  scope: "sucursal-periodo" | "deposito" | "sucursal";
  fetchPage(client: NinoxClient, job: IngestJob, page: number, call: CallOptions): Promise<PageResult>;
  /** Vuelca las filas descargadas reemplazando el alcance del job. Corre dentro de una transacción. */
  commit(db: Db, job: IngestJob, rows: unknown[]): number;
}

const PAGE_SIZE_COMPROBANTES = 500;
const PAGE_SIZE_SALDOS = 100;

function splitPeriodo(periodo: string | undefined): { anio: number; mes: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(periodo ?? "");
  if (!match) throw new Error("El job no tiene un período válido");
  return { anio: Number(match[1]), mes: Number(match[2]) };
}

function requireSucursal(job: IngestJob): number {
  if (!job.params.sucursalId) throw new Error("El job no tiene sucursal");
  return job.params.sucursalId;
}

function exportHandler(kind: ExportKind, incluirMediosPago: boolean) {
  return async (client: NinoxClient, job: IngestJob, page: number, call: CallOptions): Promise<PageResult> => {
    const { anio, mes } = splitPeriodo(job.params.periodo);
    const result = await client.exportPaged(
      kind,
      { sucursalId: requireSucursal(job), anio, mes, page, pageSize: PAGE_SIZE_COMPROBANTES, incluirMediosPago },
      call
    );
    return { items: result?.items ?? [], totalPages: result?.totalPaginas ?? 0 };
  };
}

function fechaText(item: { fechaText?: string | null; fecha?: string | null }): string {
  if (item.fechaText && /^\d{4}-\d{2}-\d{2}$/.test(item.fechaText)) return item.fechaText;
  return toIsoOrNull(item.fecha)?.slice(0, 10) ?? "";
}

function comprobanteBase(item: NinoxVentaItem | NinoxCompraItem | NinoxVentaTotal | NinoxCompraTotal, job: IngestJob) {
  return {
    factura_id: item.facturaId,
    comprobante_tipo: item.comprobanteTipo,
    tipo_documento: item.tipoDocumento ?? null,
    fecha: toIsoOrNull(item.fecha),
    fecha_text: fechaText(item),
    hora_text: item.horaText ?? null,
    numero_full: item.numeroFull ?? null,
    sucursal_id: item.sucursalId ?? job.params.sucursalId,
    sucursal: item.sucursal ?? null,
    app_id: item.appId ?? null,
    detalle: item.detalle ?? null,
    periodo: job.params.periodo,
    job_id: job.id
  };
}

function insertAll(db: Db, table: string, rows: Array<Record<string, unknown>>, orReplace = false): number {
  if (rows.length === 0) return 0;
  const columns = Object.keys(rows[0]);
  const statement = db.prepare(
    `INSERT ${orReplace ? "OR REPLACE " : ""}INTO ${table} (${columns.join(", ")}) VALUES (${columns.map((c) => `@${c}`).join(", ")})`
  );
  for (const row of rows) statement.run(row);
  return rows.length;
}

function deleteScope(db: Db, tables: string[], job: IngestJob): void {
  for (const table of tables) {
    db.prepare(`DELETE FROM ${table} WHERE sucursal_id = ? AND periodo = ?`).run(requireSucursal(job), job.params.periodo);
  }
}

function formasPagoRows(items: Array<{ facturaId: number; formasPago?: NinoxFormaPago[] | null }>, job: IngestJob) {
  return items.flatMap((item) =>
    (item.formasPago ?? []).map((fp) => ({
      factura_id: fp.facturaId ?? item.facturaId,
      tipo: fp.tipo,
      tipo_text: fp.tipoText ?? null,
      detalle: fp.detalle ?? null,
      importe: fp.importe ?? 0,
      sucursal_id: requireSucursal(job),
      periodo: job.params.periodo,
      job_id: job.id
    }))
  );
}

export const handlers: Record<IngestType, IngestHandler> = {
  ventas_items: {
    type: "ventas_items",
    label: "Ventas · ítems",
    group: "ventas",
    enabled: true,
    bucket: "comprobantePaginado",
    scope: "sucursal-periodo",
    fetchPage: exportHandler("ventaitems", false),
    commit(db, job, rows) {
      deleteScope(db, ["ventas_items"], job);
      return insertAll(
        db,
        "ventas_items",
        (rows as NinoxVentaItem[]).map((item) => ({
          ...comprobanteBase(item, job),
          cliente: item.cliente ?? null,
          vendedor: item.vendedor ?? null,
          codigo: item.codigo ?? null,
          descripcion: item.descripcion ?? null,
          talle: item.talle ?? null,
          color: item.color ?? null,
          cantidad: item.cantidad ?? 0,
          costo_item: item.costoItem ?? null,
          costo_articulo: item.costoArticulo ?? null,
          precio_venta: item.precioVenta ?? null,
          precio_venta_final: item.precioVentaFinal ?? null,
          precio_lista1: item.precioLista1 ?? null,
          precio_lista2: item.precioLista2 ?? null
        }))
      );
    }
  },
  ventas_totales: {
    type: "ventas_totales",
    label: "Ventas · totales y medios de pago",
    group: "ventas",
    enabled: true,
    bucket: "comprobantePaginado",
    scope: "sucursal-periodo",
    fetchPage: exportHandler("ventatotales", true),
    commit(db, job, rows) {
      const items = rows as NinoxVentaTotal[];
      deleteScope(db, ["ventas_totales", "ventas_formas_pago"], job);
      insertAll(db, "ventas_formas_pago", formasPagoRows(items, job));
      return insertAll(
        db,
        "ventas_totales",
        items.map((item) => ({
          ...comprobanteBase(item, job),
          cliente: item.cliente ?? null,
          vendedor: item.vendedor ?? null,
          email: item.email ?? null,
          dni: item.dni ?? null,
          sub_total: item.subTotal ?? 0,
          total: item.total ?? 0,
          descuento: item.descuento ?? 0,
          recargo: item.recargo ?? 0,
          iva: item.iva ?? 0,
          impuestos_total: item.impuestosTotal ?? 0,
          cantidad: item.cantidad ?? 0,
          formas_pago_text: item.formasPagoText ?? null
        })),
        true
      );
    }
  },
  compras_items: {
    type: "compras_items",
    label: "Compras · ítems",
    group: "compras",
    enabled: true,
    bucket: "comprobantePaginado",
    scope: "sucursal-periodo",
    fetchPage: exportHandler("compraitems", false),
    commit(db, job, rows) {
      deleteScope(db, ["compras_items"], job);
      return insertAll(
        db,
        "compras_items",
        (rows as NinoxCompraItem[]).map((item) => ({
          ...comprobanteBase(item, job),
          deposito_id: item.depositoId ?? null,
          proveedor: item.proveedor ?? null,
          empleado: item.empleado ?? null,
          codigo: item.codigo ?? null,
          descripcion: item.descripcion ?? null,
          talle: item.talle ?? null,
          color: item.color ?? null,
          lote: item.lote ?? null,
          cantidad: item.cantidad ?? 0,
          costo_item: item.costoItem ?? null,
          costo_articulo: item.costoArticulo ?? null,
          precio_compra: item.precioCompra ?? null,
          precio_compra_final: item.precioCompraFinal ?? null
        }))
      );
    }
  },
  compras_totales: {
    type: "compras_totales",
    label: "Compras · totales y medios de pago",
    group: "compras",
    enabled: true,
    bucket: "comprobantePaginado",
    scope: "sucursal-periodo",
    fetchPage: exportHandler("compratotales", true),
    commit(db, job, rows) {
      const items = rows as NinoxCompraTotal[];
      deleteScope(db, ["compras_totales", "compras_formas_pago"], job);
      insertAll(db, "compras_formas_pago", formasPagoRows(items, job));
      return insertAll(
        db,
        "compras_totales",
        items.map((item) => ({
          ...comprobanteBase(item, job),
          proveedor: item.proveedor ?? null,
          empleado: item.empleado ?? null,
          sub_total: item.subTotal ?? 0,
          total: item.total ?? 0,
          descuento: item.descuento ?? 0,
          recargo: item.recargo ?? 0,
          iva: item.iva ?? 0,
          impuestos_total: item.impuestosTotal ?? 0,
          cantidad: item.cantidad ?? 0,
          formas_pago_text: item.formasPagoText ?? null
        })),
        true
      );
    }
  },

  // ── Preparados para la próxima etapa (enabled: false) ────────────────────
  // Para activarlos: poner enabled = true y agregar el formulario en la página de
  // Ingesta. Ver docs/modules/ingesta.md.
  stock: {
    type: "stock",
    label: "Stock por depósito",
    group: "stock",
    enabled: false,
    bucket: "masivo",
    scope: "deposito",
    async fetchPage(client, job, _page, call) {
      if (!job.params.depositoId) throw new Error("El job no tiene depósito");
      const result = await client.exportStock(job.params.depositoId, call);
      return { items: result?.stock ?? [], totalPages: 1 };
    },
    commit(db, job, rows) {
      const snapshot = db
        .prepare("INSERT INTO stock_snapshots (deposito_id, registros, taken_at, job_id) VALUES (?, ?, ?, ?)")
        .run(job.params.depositoId, rows.length, new Date().toISOString(), job.id);
      const snapshotId = Number(snapshot.lastInsertRowid);
      return insertAll(
        db,
        "stock_snapshot_items",
        (rows as NinoxStockItem[]).map((item) => ({
          snapshot_id: snapshotId,
          articulo_id: item.articuloId ?? null,
          codigo: item.codigo ?? null,
          descripcion: item.descripcion ?? null,
          sucursal_id: item.sucursalId ?? null,
          deposito_id: item.depositoId ?? job.params.depositoId ?? null,
          color_id: item.colorId ?? null,
          color_nombre: item.colorNombre ?? null,
          talle_id: item.talleId ?? null,
          talle_nombre: item.talleNombre ?? null,
          cantidad: item.cantidad ?? 0,
          reservado: item.reservado ?? 0,
          total: item.total ?? 0
        }))
      );
    }
  },
  saldos_clientes: saldosHandler("cliente"),
  saldos_proveedores: saldosHandler("proveedor")
};

function saldosHandler(tipo: "cliente" | "proveedor"): IngestHandler {
  return {
    type: tipo === "cliente" ? "saldos_clientes" : "saldos_proveedores",
    label: tipo === "cliente" ? "Saldos de clientes" : "Saldos de proveedores",
    group: "saldos",
    enabled: false,
    bucket: "saldos",
    scope: "sucursal",
    async fetchPage(client, job, page, call) {
      const result = await client.saldosPaginado(
        tipo === "cliente" ? "clientes" : "proveedores",
        { sucursalId: job.params.sucursalId, page, pageSize: PAGE_SIZE_SALDOS },
        call
      );
      const total = result?.totalFiltrados ?? result?.totalRegistros ?? 0;
      return { items: result?.saldos ?? [], totalPages: Math.ceil(total / PAGE_SIZE_SALDOS) };
    },
    commit(db, job, rows) {
      const items = rows as NinoxSaldoItem[];
      const snapshot = db
        .prepare(
          "INSERT INTO saldos_snapshots (tipo, sucursal_id, saldo_total, registros, taken_at, job_id) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .run(
          tipo,
          job.params.sucursalId ?? null,
          items.reduce((sum, item) => sum + (item.saldo ?? 0), 0),
          items.length,
          new Date().toISOString(),
          job.id
        );
      const snapshotId = Number(snapshot.lastInsertRowid);
      return insertAll(
        db,
        "saldos_items",
        items.map((item) => ({
          snapshot_id: snapshotId,
          entidad_id: item.entidadId,
          nombre: item.nombre ?? null,
          razon_social: item.razonSocial ?? null,
          saldo: item.saldo ?? 0,
          saldo15: item.saldo15 ?? 0,
          saldo30: item.saldo30 ?? 0,
          saldo60: item.saldo60 ?? 0,
          saldo90: item.saldo90 ?? 0,
          saldo90_mas: item.saldo90Mas ?? 0,
          cantidad_facturas: item.cantidadFacturas ?? 0,
          total_ultimo_pago: item.totalUltimoPago ?? null,
          fecha_ultimo_pago: toIsoOrNull(item.fechaUltimoPago) ?? item.fechaUltimoPago ?? null
        }))
      );
    }
  };
}
