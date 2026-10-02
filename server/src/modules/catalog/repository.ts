import type { Db } from "../../db/connection.js";
import type { CatalogSnapshot } from "./mapper.js";

export interface StockVariant {
  code?: string;
  name: string;
  stock: number | null;
  talleId?: number;
  colorId?: number;
}

/** Fila que consume la vista de stock y el buscador de artículos del formulario de pedidos. */
export interface StockRow {
  articuloId: number | null;
  code: string;
  name: string;
  description?: string;
  stock: number | null;
  categories: string[];
  tags: string[];
  price: number | null;
  colors: string[];
  sizes: string[];
  variants: StockVariant[];
}

export interface CatalogSummary {
  hasData: boolean;
  totalProducts: number;
  totalVariants: number;
  totalStock: number;
  outOfStockProducts: number;
  availableColors: number;
  availableSizes: number;
}

const TAG_CATEGORIA = 1;

/**
 * Reemplaza el catálogo completo en una transacción. Los artículos que no vienen en
 * el snapshot quedan con eliminado = 1 (no se borran, para no romper referencias).
 */
export function replaceCatalog(db: Db, snapshot: CatalogSnapshot, syncedAt: string): void {
  const upsertArticulo = db.prepare(`
    INSERT INTO articulos (
      articulo_id, codigo, nombre, descripcion, descripcion_web, talle_color, precio_venta,
      precio1, precio2, precio3, precio4, precio5, stock_total, imagen, eliminado, raw_json, synced_at
    ) VALUES (
      @articulo_id, @codigo, @nombre, @descripcion, @descripcion_web, @talle_color, @precio_venta,
      @precio1, @precio2, @precio3, @precio4, @precio5, @stock_total, @imagen, 0, @raw_json, @synced_at
    )
    ON CONFLICT(articulo_id) DO UPDATE SET
      codigo = excluded.codigo, nombre = excluded.nombre, descripcion = excluded.descripcion,
      descripcion_web = excluded.descripcion_web, talle_color = excluded.talle_color,
      precio_venta = excluded.precio_venta, precio1 = excluded.precio1, precio2 = excluded.precio2,
      precio3 = excluded.precio3, precio4 = excluded.precio4, precio5 = excluded.precio5,
      stock_total = excluded.stock_total, imagen = excluded.imagen, eliminado = 0,
      raw_json = excluded.raw_json, synced_at = excluded.synced_at
  `);
  const insertVariante = db.prepare(`
    INSERT INTO articulo_variantes (
      articulo_id, color_id, talle_id, color_nombre, color_codigo, color_hex,
      talle_nombre, talle_codigo, codigo_barras, unidades
    ) VALUES (
      @articulo_id, @color_id, @talle_id, @color_nombre, @color_codigo, @color_hex,
      @talle_nombre, @talle_codigo, @codigo_barras, @unidades
    )
  `);
  const upsertTag = db.prepare(`
    INSERT INTO tags (tag_id, tipo, nombre, padre_id) VALUES (@tag_id, @tipo, @nombre, @padre_id)
    ON CONFLICT(tag_id) DO UPDATE SET tipo = excluded.tipo, nombre = excluded.nombre, padre_id = excluded.padre_id
  `);
  const insertArticuloTag = db.prepare("INSERT OR IGNORE INTO articulo_tags (articulo_id, tag_id) VALUES (?, ?)");

  db.transaction(() => {
    db.exec("DELETE FROM articulo_variantes; DELETE FROM articulo_tags; UPDATE articulos SET eliminado = 1;");
    for (const tag of snapshot.tags) upsertTag.run(tag);
    for (const articulo of snapshot.articulos) upsertArticulo.run({ ...articulo, synced_at: syncedAt });
    for (const variante of snapshot.variantes) insertVariante.run(variante);
    for (const link of snapshot.articuloTags) insertArticuloTag.run(link.articulo_id, link.tag_id);
  })();
}

function upperUnique(values: Array<string | null>): string[] {
  const map = new Map<string, string>();
  for (const value of values) {
    if (!value?.trim()) continue;
    const key = value.trim().toUpperCase();
    if (!map.has(key)) map.set(key, key);
  }
  return [...map.values()].sort();
}

function variantName(color: string | null, talle: string | null): string {
  return [color, talle].filter((value) => value?.trim()).join(" / ") || "Única";
}

export function listStockRows(
  db: Db,
  filters: { search?: string; color?: string; size?: string; limit?: number }
): { items: StockRow[]; total: number } {
  const where = ["a.eliminado = 0"];
  const params: Record<string, unknown> = {};

  if (filters.search) {
    where.push(`(
      a.codigo LIKE @search OR a.nombre LIKE @search OR a.descripcion LIKE @search
      OR EXISTS (SELECT 1 FROM articulo_tags at JOIN tags t ON t.tag_id = at.tag_id
                 WHERE at.articulo_id = a.articulo_id AND t.nombre LIKE @search)
      OR EXISTS (SELECT 1 FROM articulo_variantes v
                 WHERE v.articulo_id = a.articulo_id AND v.codigo_barras LIKE @search)
    )`);
    params.search = `%${filters.search}%`;
  }
  if (filters.color) {
    where.push(
      "EXISTS (SELECT 1 FROM articulo_variantes v WHERE v.articulo_id = a.articulo_id AND UPPER(TRIM(v.color_nombre)) = UPPER(@color))"
    );
    params.color = filters.color.trim();
  }
  if (filters.size) {
    where.push(
      "EXISTS (SELECT 1 FROM articulo_variantes v WHERE v.articulo_id = a.articulo_id AND UPPER(TRIM(v.talle_nombre)) = UPPER(@size))"
    );
    params.size = filters.size.trim();
  }

  const whereSql = where.join(" AND ");
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM articulos a WHERE ${whereSql}`).get(params) as { n: number }).n;
  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);

  const articulos = db
    .prepare(
      `SELECT articulo_id, codigo, nombre, descripcion, descripcion_web, stock_total, precio_venta
       FROM articulos a WHERE ${whereSql} ORDER BY a.nombre COLLATE NOCASE LIMIT ${limit}`
    )
    .all(params) as Array<{
    articulo_id: number;
    codigo: string;
    nombre: string;
    descripcion: string | null;
    descripcion_web: string | null;
    stock_total: number;
    precio_venta: number | null;
  }>;

  if (articulos.length === 0) return { items: [], total };

  const ids = articulos.map((a) => a.articulo_id);
  const placeholders = ids.map(() => "?").join(",");

  const variantes = db
    .prepare(
      `SELECT articulo_id, color_id, talle_id, color_nombre, talle_nombre, codigo_barras, unidades
       FROM articulo_variantes WHERE articulo_id IN (${placeholders}) ORDER BY id`
    )
    .all(...ids) as Array<{
    articulo_id: number;
    color_id: number | null;
    talle_id: number | null;
    color_nombre: string | null;
    talle_nombre: string | null;
    codigo_barras: string | null;
    unidades: number;
  }>;

  const tagRows = db
    .prepare(
      `SELECT at.articulo_id, t.tipo, t.nombre FROM articulo_tags at JOIN tags t ON t.tag_id = at.tag_id
       WHERE at.articulo_id IN (${placeholders}) ORDER BY t.nombre`
    )
    .all(...ids) as Array<{ articulo_id: number; tipo: number; nombre: string }>;

  const items = articulos.map<StockRow>((articulo) => {
    const own = variantes.filter((v) => v.articulo_id === articulo.articulo_id);
    const ownTags = tagRows.filter((t) => t.articulo_id === articulo.articulo_id);
    return {
      articuloId: articulo.articulo_id,
      code: articulo.codigo,
      name: articulo.nombre,
      description: articulo.descripcion_web ?? articulo.descripcion ?? undefined,
      stock: articulo.stock_total,
      price: articulo.precio_venta,
      categories: ownTags.filter((t) => t.tipo === TAG_CATEGORIA).map((t) => t.nombre),
      tags: ownTags.filter((t) => t.tipo !== TAG_CATEGORIA).map((t) => t.nombre),
      colors: upperUnique(own.map((v) => v.color_nombre)),
      sizes: upperUnique(own.map((v) => v.talle_nombre)),
      variants: own.map((v) => ({
        code: v.codigo_barras ?? undefined,
        name: variantName(v.color_nombre, v.talle_nombre),
        stock: v.unidades,
        talleId: v.talle_id ?? undefined,
        colorId: v.color_id ?? undefined
      }))
    };
  });

  return { items, total };
}

export function getFacets(db: Db): { colors: string[]; sizes: string[] } {
  const rows = db
    .prepare(
      `SELECT v.color_nombre, v.talle_nombre FROM articulo_variantes v
       JOIN articulos a ON a.articulo_id = v.articulo_id WHERE a.eliminado = 0`
    )
    .all() as Array<{ color_nombre: string | null; talle_nombre: string | null }>;

  return {
    colors: upperUnique(rows.map((r) => r.color_nombre)),
    sizes: upperUnique(rows.map((r) => r.talle_nombre))
  };
}

export function getSummary(db: Db): CatalogSummary {
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS products,
              COALESCE(SUM(stock_total), 0) AS stock,
              COALESCE(SUM(CASE WHEN stock_total <= 0 THEN 1 ELSE 0 END), 0) AS outOfStock
       FROM articulos WHERE eliminado = 0`
    )
    .get() as { products: number; stock: number; outOfStock: number };
  const variants = (
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM articulo_variantes v JOIN articulos a ON a.articulo_id = v.articulo_id WHERE a.eliminado = 0"
      )
      .get() as { n: number }
  ).n;
  const facets = getFacets(db);

  return {
    hasData: totals.products > 0,
    totalProducts: totals.products,
    totalVariants: variants,
    totalStock: totals.stock,
    outOfStockProducts: totals.outOfStock,
    availableColors: facets.colors.length,
    availableSizes: facets.sizes.length
  };
}
