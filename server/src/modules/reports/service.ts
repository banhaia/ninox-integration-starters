import type { Db } from "../../db/connection.js";
import { periodRange } from "../../ninox/dates.js";

/**
 * Módulo interno de reportes. Lee SOLO de la base local (datos ingestados), nunca
 * llama a Ninox, así puede reutilizarse desde otras piezas (chatbot, exportaciones,
 * tareas programadas) sin consumir rate limit.
 *
 * Convenciones de signo: las notas de crédito (venta tipo 4, compra tipo 3) restan.
 * Se usa ABS() sobre los importes para no depender del signo con que las exporta Ninox.
 */

export interface ReportFilters {
  sucursalId?: number;
}

export interface MonthlyRow {
  periodo: string;
  ventasBrutas: number;
  notasCredito: number;
  ventasNetas: number;
  comprobantes: number;
  ticketPromedio: number;
  unidades: number;
  /** Venta neta calculada desde los ítems (cantidad × precio final). */
  ventasItems: number;
  costo: number;
  margenBruto: number;
  margenPorcentaje: number | null;
  comprasNetas: number;
  comprobantesCompra: number;
}

export interface Coverage {
  ventasTotales: string[];
  ventasItems: string[];
  comprasTotales: string[];
  comprasItems: string[];
}

const VENTA_NC = 4;
const COMPRA_NC = 3;

function scopeSql(filters: ReportFilters, params: unknown[]): string {
  if (!filters.sucursalId) return "";
  params.push(filters.sucursalId);
  return " AND sucursal_id = ?";
}

const round = (value: number): number => Math.round(value * 100) / 100;

export function getCoverage(db: Db, filters: ReportFilters = {}): Coverage {
  const periods = (table: string): string[] => {
    const params: unknown[] = [];
    const where = scopeSql(filters, params);
    return (
      db.prepare(`SELECT DISTINCT periodo FROM ${table} WHERE 1 = 1${where} ORDER BY periodo`).all(...params) as Array<{
        periodo: string;
      }>
    ).map((row) => row.periodo);
  };

  return {
    ventasTotales: periods("ventas_totales"),
    ventasItems: periods("ventas_items"),
    comprasTotales: periods("compras_totales"),
    comprasItems: periods("compras_items")
  };
}

export function getMonthly(db: Db, desde: string, hasta: string, filters: ReportFilters = {}): MonthlyRow[] {
  const periodos = periodRange(desde, hasta);

  const ventasParams: unknown[] = [VENTA_NC, VENTA_NC, VENTA_NC, desde, hasta];
  const ventas = db
    .prepare(
      `SELECT periodo,
              SUM(CASE WHEN comprobante_tipo <> ? THEN ABS(total) ELSE 0 END) AS brutas,
              SUM(CASE WHEN comprobante_tipo = ? THEN ABS(total) ELSE 0 END) AS nc,
              SUM(CASE WHEN comprobante_tipo <> ? THEN 1 ELSE 0 END) AS comprobantes
       FROM ventas_totales WHERE periodo BETWEEN ? AND ?${scopeSql(filters, ventasParams)}
       GROUP BY periodo`
    )
    .all(...ventasParams) as Array<{ periodo: string; brutas: number; nc: number; comprobantes: number }>;

  const itemsParams: unknown[] = [VENTA_NC, VENTA_NC, VENTA_NC, desde, hasta];
  const items = db
    .prepare(
      `SELECT periodo,
              SUM(CASE WHEN comprobante_tipo = ? THEN -1 ELSE 1 END * ABS(cantidad)) AS unidades,
              SUM(CASE WHEN comprobante_tipo = ? THEN -1 ELSE 1 END * ABS(cantidad) * COALESCE(precio_venta_final, precio_venta, 0)) AS importe,
              SUM(CASE WHEN comprobante_tipo = ? THEN -1 ELSE 1 END * ABS(cantidad) * COALESCE(costo_item, costo_articulo, 0)) AS costo
       FROM ventas_items WHERE periodo BETWEEN ? AND ?${scopeSql(filters, itemsParams)}
       GROUP BY periodo`
    )
    .all(...itemsParams) as Array<{ periodo: string; unidades: number; importe: number; costo: number }>;

  const comprasParams: unknown[] = [COMPRA_NC, COMPRA_NC, desde, hasta];
  const compras = db
    .prepare(
      `SELECT periodo,
              SUM(CASE WHEN comprobante_tipo = ? THEN -1 ELSE 1 END * ABS(total)) AS netas,
              SUM(CASE WHEN comprobante_tipo <> ? THEN 1 ELSE 0 END) AS comprobantes
       FROM compras_totales WHERE periodo BETWEEN ? AND ?${scopeSql(filters, comprasParams)}
       GROUP BY periodo`
    )
    .all(...comprasParams) as Array<{ periodo: string; netas: number; comprobantes: number }>;

  const byPeriod = <T extends { periodo: string }>(rows: T[]) => new Map(rows.map((row) => [row.periodo, row]));
  const ventasMap = byPeriod(ventas);
  const itemsMap = byPeriod(items);
  const comprasMap = byPeriod(compras);

  return periodos.map((periodo) => {
    const v = ventasMap.get(periodo);
    const i = itemsMap.get(periodo);
    const c = comprasMap.get(periodo);
    const ventasBrutas = v?.brutas ?? 0;
    const notasCredito = v?.nc ?? 0;
    const comprobantes = v?.comprobantes ?? 0;
    const ventasItems = i?.importe ?? 0;
    const costo = i?.costo ?? 0;
    const margenBruto = ventasItems - costo;

    return {
      periodo,
      ventasBrutas: round(ventasBrutas),
      notasCredito: round(notasCredito),
      ventasNetas: round(ventasBrutas - notasCredito),
      comprobantes,
      ticketPromedio: comprobantes > 0 ? round(ventasBrutas / comprobantes) : 0,
      unidades: round(i?.unidades ?? 0),
      ventasItems: round(ventasItems),
      costo: round(costo),
      margenBruto: round(margenBruto),
      margenPorcentaje: ventasItems > 0 ? round((margenBruto / ventasItems) * 100) : null,
      comprasNetas: round(c?.netas ?? 0),
      comprobantesCompra: c?.comprobantes ?? 0
    };
  });
}

export function getTopProducts(
  db: Db,
  periodo: string,
  filters: ReportFilters = {},
  limit = 10
): Array<{ codigo: string; descripcion: string; unidades: number; importe: number }> {
  const params: unknown[] = [VENTA_NC, VENTA_NC, periodo];
  const where = scopeSql(filters, params);
  params.push(Math.min(Math.max(limit, 1), 50));

  const rows = db
    .prepare(
      `SELECT COALESCE(codigo, '(sin código)') AS codigo, MAX(descripcion) AS descripcion,
              SUM(CASE WHEN comprobante_tipo = ? THEN -1 ELSE 1 END * ABS(cantidad)) AS unidades,
              SUM(CASE WHEN comprobante_tipo = ? THEN -1 ELSE 1 END * ABS(cantidad) * COALESCE(precio_venta_final, precio_venta, 0)) AS importe
       FROM ventas_items WHERE periodo = ?${where}
       GROUP BY COALESCE(codigo, '(sin código)') ORDER BY importe DESC LIMIT ?`
    )
    .all(...params) as Array<{ codigo: string; descripcion: string | null; unidades: number; importe: number }>;

  return rows.map((row) => ({
    codigo: row.codigo,
    descripcion: row.descripcion ?? "",
    unidades: round(row.unidades),
    importe: round(row.importe)
  }));
}

export function getPaymentMethods(
  db: Db,
  periodo: string,
  filters: ReportFilters = {}
): Array<{ tipo: number; medio: string; importe: number }> {
  const params: unknown[] = [VENTA_NC, periodo];
  const where = filters.sucursalId ? " AND fp.sucursal_id = ?" : "";
  if (filters.sucursalId) params.push(filters.sucursalId);

  const rows = db
    .prepare(
      `SELECT fp.tipo, COALESCE(MAX(fp.tipo_text), 'Tipo ' || fp.tipo) AS medio,
              SUM(CASE WHEN vt.comprobante_tipo = ? THEN -1 ELSE 1 END * ABS(fp.importe)) AS importe
       FROM ventas_formas_pago fp
       LEFT JOIN ventas_totales vt ON vt.factura_id = fp.factura_id
       WHERE fp.periodo = ?${where}
       GROUP BY fp.tipo ORDER BY importe DESC`
    )
    .all(...params) as Array<{ tipo: number; medio: string; importe: number }>;

  return rows.map((row) => ({ ...row, importe: round(row.importe) }));
}

export function getSucursales(db: Db): Array<{ sucursalId: number; nombre: string }> {
  return db
    .prepare(
      `SELECT sucursal_id AS sucursalId, MAX(sucursal) AS nombre FROM (
         SELECT sucursal_id, sucursal FROM ventas_totales
         UNION ALL SELECT sucursal_id, sucursal FROM ventas_items
         UNION ALL SELECT sucursal_id, sucursal FROM compras_totales
       ) GROUP BY sucursal_id ORDER BY nombre`
    )
    .all() as Array<{ sucursalId: number; nombre: string }>;
}
