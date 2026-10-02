import type { NinoxArticulo } from "../../ninox/types.js";

/**
 * Normaliza la respuesta de GetData al modelo de tablas locales.
 * Es tolerante: acepta campos faltantes o con nombres alternativos que aparecen en
 * distintas versiones del endpoint (precioVenta, stockCantidad, curva.cantidad, ...).
 */

export interface ArticuloRow {
  articulo_id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  descripcion_web: string | null;
  talle_color: number;
  precio_venta: number | null;
  precio1: number | null;
  precio2: number | null;
  precio3: number | null;
  precio4: number | null;
  precio5: number | null;
  stock_total: number;
  imagen: string | null;
  raw_json: string;
}

export interface VarianteRow {
  articulo_id: number;
  color_id: number | null;
  talle_id: number | null;
  color_nombre: string | null;
  color_codigo: string | null;
  color_hex: string | null;
  talle_nombre: string | null;
  talle_codigo: string | null;
  codigo_barras: string | null;
  unidades: number;
}

export interface TagRow {
  tag_id: number;
  tipo: number;
  nombre: string;
  padre_id: number | null;
}

export interface CatalogSnapshot {
  articulos: ArticuloRow[];
  variantes: VarianteRow[];
  tags: TagRow[];
  articuloTags: Array<{ articulo_id: number; tag_id: number }>;
}

type Loose = Record<string, unknown>;

function isRecord(value: unknown): value is Loose {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function num(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function int(...values: unknown[]): number | null {
  const value = num(...values);
  return value !== null && Number.isInteger(value) ? value : null;
}

export function mapCatalog(input: NinoxArticulo[] | unknown[]): CatalogSnapshot {
  const articulos: ArticuloRow[] = [];
  const variantes: VarianteRow[] = [];
  const tags = new Map<number, TagRow>();
  const articuloTags: Array<{ articulo_id: number; tag_id: number }> = [];
  const seen = new Set<number>();

  for (const item of input) {
    if (!isRecord(item)) continue;
    const articuloId = int(item.articuloId);
    if (articuloId === null || seen.has(articuloId)) continue;
    seen.add(articuloId);

    const curva = Array.isArray(item.curva) ? item.curva.filter(isRecord) : [];
    const itemVariantes: VarianteRow[] = curva.map((variante) => ({
      articulo_id: articuloId,
      color_id: int(variante.colorId),
      talle_id: int(variante.talleId),
      color_nombre: str(variante.colorNombre),
      color_codigo: str(variante.colorCodigo),
      color_hex: str(variante.colorHex),
      talle_nombre: str(variante.talleNombre),
      talle_codigo: str(variante.talleCodigo),
      codigo_barras: str(variante.codigoBarras, variante.codigoCurva),
      unidades: num(variante.unidades, variante.cantidad, variante.total) ?? 0
    }));
    variantes.push(...itemVariantes);

    const stockVariantes = itemVariantes.reduce((total, variante) => total + variante.unidades, 0);
    const codigo = str(item.codigo) ?? String(articuloId);

    articulos.push({
      articulo_id: articuloId,
      codigo,
      nombre: str(item.nombre, item.descripcion, item.descripcionWeb) ?? codigo,
      descripcion: str(item.descripcion),
      descripcion_web: str(item.descripcionWeb),
      talle_color: int(item.talleColor) ?? 0,
      precio_venta: num(item.precioVenta, item.precio1),
      precio1: num(item.precio1),
      precio2: num(item.precio2),
      precio3: num(item.precio3),
      precio4: num(item.precio4),
      precio5: num(item.precio5),
      stock_total: num(item.stockTotal, item.stockCantidad) ?? stockVariantes,
      imagen: str(item.imagen),
      raw_json: JSON.stringify(item)
    });

    const itemTags = Array.isArray(item.tags) ? item.tags.filter(isRecord) : [];
    const tagIds = new Set<number>();
    for (const tag of itemTags) {
      const tagId = int(tag.tagId);
      const nombre = str(tag.tagNombre, tag.nombre);
      if (tagId === null || !nombre) continue;
      tags.set(tagId, { tag_id: tagId, tipo: int(tag.tipo) ?? 0, nombre, padre_id: int(tag.padreId) });
      if (!tagIds.has(tagId)) {
        tagIds.add(tagId);
        articuloTags.push({ articulo_id: articuloId, tag_id: tagId });
      }
    }
  }

  return { articulos, variantes, tags: [...tags.values()], articuloTags };
}
