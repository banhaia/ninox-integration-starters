import type { Product, Variant } from "ninox-node-typescript-template";

const DEFAULT_MAX_CONTEXT_PRODUCTS = 8;
const QUERY_STOPWORDS = new Set([
  "stock",
  "precio",
  "precios",
  "disponible",
  "disponibles",
  "tenes",
  "tienes",
  "tenés",
  "talle",
  "talles",
  "color",
  "colores",
  "hay",
  "para",
  "con",
  "una",
  "uno",
  "del",
  "las",
  "los"
]);

function getMaxContextProducts(): number {
  const raw = process.env.STOCK_CONTEXT_MAX_PRODUCTS?.trim();
  if (!raw) {
    return DEFAULT_MAX_CONTEXT_PRODUCTS;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_MAX_CONTEXT_PRODUCTS;
}

function readRawField(raw: unknown, keys: string[]): string | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }

  const record = raw as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function splitVariantName(name: string): { color?: string; size?: string } {
  const separator = " / ";
  const separatorIndex = name.lastIndexOf(separator);
  if (separatorIndex === -1) {
    return {};
  }

  return {
    color: name.slice(0, separatorIndex).trim(),
    size: name.slice(separatorIndex + separator.length).trim()
  };
}

function unique(values: Array<string | undefined | null>): string[] {
  const canonical = new Map<string, string>();

  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (!canonical.has(key)) {
      canonical.set(key, trimmed);
    }
  }

  return [...canonical.values()].sort((a, b) => a.localeCompare(b));
}

function collectColors(product: Product, variant: Variant): string[] {
  const fromVariantName = splitVariantName(variant.name);

  return unique([
    readRawField(variant.raw, ["colorNombre", "color", "colour", "Color"]),
    readRawField(product.raw, ["colorNombre", "color", "colour", "Color"]),
    fromVariantName.color
  ]);
}

function collectSizes(product: Product, variant: Variant): string[] {
  const fromVariantName = splitVariantName(variant.name);

  return unique([
    readRawField(variant.raw, ["talleNombre", "size", "talle", "talla", "Size"]),
    readRawField(product.raw, ["talleNombre", "size", "talle", "talla", "Size"]),
    fromVariantName.size
  ]);
}

function formatPrice(product: Product): string {
  const price = product.prices[0];
  if (!price) {
    return "sin precio informado";
  }

  const currency = price.currency ? `${price.currency} ` : "$";
  return `${currency}${price.amount}`;
}

function formatStock(stock: number | null | undefined): string {
  if (typeof stock !== "number") {
    return "stock no informado";
  }

  return `${stock} unidad${stock === 1 ? "" : "es"}`;
}

function formatVariants(product: Product): string {
  const variants = product.variants
    .filter((variant) => typeof variant.stock !== "number" || variant.stock > 0)
    .slice(0, 6)
    .map((variant) => {
      const colors = collectColors(product, variant);
      const sizes = collectSizes(product, variant);
      const details = [...colors, ...sizes].join(" ");
      const name = details || variant.name;
      return `${name}: ${formatStock(variant.stock)}`;
    });

  if (variants.length === 0) {
    return "";
  }

  return ` Variantes: ${variants.join("; ")}.`;
}

function rankProducts(products: Product[], query: string): Product[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const queryWords = unique(
    normalizedQuery
      .split(/\s+/)
      .map((word) => word.replace(/[^\p{L}\p{N}-]/gu, ""))
      .filter((word) => word.length >= 3 && !QUERY_STOPWORDS.has(word))
  );

  if (queryWords.length === 0) {
    return [];
  }

  return products
    .map((product) => {
      const haystack = [
        product.code,
        product.name,
        product.description ?? "",
        ...product.categories.map((category) => category.name),
        ...product.tags.map((tag) => tag.name),
        ...product.variants.map((variant) => [variant.code, variant.sku, variant.name].filter(Boolean).join(" "))
      ]
        .join(" ")
        .toLowerCase();

      const score = queryWords.reduce(
        (total, word) => total + (haystack.includes(word.toLowerCase()) ? 1 : 0),
        haystack.includes(normalizedQuery) ? 5 : 0
      );

      return { product, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.product);
}

export function buildStockContext(products: Product[], query: string): string {
  if (products.length === 0) {
    return [
      "--- STOCK DISPONIBLE ---",
      "No hay stock cacheado todavía. Si preguntan por disponibilidad, indicá que no tenés información actualizada de stock."
    ].join("\n");
  }

  const matches = rankProducts(products, query).slice(0, getMaxContextProducts());

  if (matches.length === 0) {
    return [
      "--- STOCK DISPONIBLE ---",
      "No se encontraron productos del stock local que coincidan con la consulta actual. No inventes disponibilidad, precios, talles ni colores."
    ].join("\n");
  }

  const lines = matches.map((product) => {
    const colors = unique(product.variants.flatMap((variant) => collectColors(product, variant)));
    const sizes = unique(product.variants.flatMap((variant) => collectSizes(product, variant)));
    const attributes = [
      colors.length > 0 ? `colores: ${colors.join(", ")}` : null,
      sizes.length > 0 ? `talles: ${sizes.join(", ")}` : null
    ].filter(Boolean);

    return [
      `- ${product.name} (${product.code})`,
      `stock total: ${formatStock(product.stock)}`,
      `precio: ${formatPrice(product)}`,
      attributes.length > 0 ? attributes.join("; ") : null,
      formatVariants(product).trim() || null
    ]
      .filter(Boolean)
      .join(" | ");
  });

  return [
    "--- STOCK DISPONIBLE ---",
    "Usá solo estos datos para responder sobre disponibilidad, precios, talles y colores. Si el producto pedido no aparece acá, decí que no encontraste stock actualizado para esa consulta.",
    ...lines
  ].join("\n");
}
