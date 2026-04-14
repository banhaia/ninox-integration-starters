import type { Product, Variant } from "ninox-node-typescript-template";

function unique(values: Array<string | undefined | null>): string[] {
  const canonical = new Map<string, string>();

  for (const value of values) {
    if (!value) {
      continue;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (!canonical.has(key)) {
      canonical.set(key, trimmed.toUpperCase());
    }
  }

  return [...canonical.values()].sort();
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

export function buildSummary(products: Product[]): {
  hasData: boolean;
  totalProducts: number;
  totalVariants: number;
  totalStock: number;
  outOfStockProducts: number;
  availableColors: number;
  availableSizes: number;
} {
  const colors = new Set<string>();
  const sizes = new Set<string>();

  for (const product of products) {
    for (const variant of product.variants) {
      for (const color of collectColors(product, variant)) {
        colors.add(color);
      }
      for (const size of collectSizes(product, variant)) {
        sizes.add(size);
      }
    }
  }

  return {
    hasData: products.length > 0,
    totalProducts: products.length,
    totalVariants: products.reduce((total, product) => total + product.variants.length, 0),
    totalStock: products.reduce((total, product) => total + (product.stock ?? 0), 0),
    outOfStockProducts: products.filter((product) => (product.stock ?? 0) <= 0).length,
    availableColors: colors.size,
    availableSizes: sizes.size
  };
}

export function buildFacets(products: Product[]): { colors: string[]; sizes: string[] } {
  const colors = new Set<string>();
  const sizes = new Set<string>();

  for (const product of products) {
    for (const variant of product.variants) {
      for (const color of collectColors(product, variant)) {
        colors.add(color);
      }
      for (const size of collectSizes(product, variant)) {
        sizes.add(size);
      }
    }
  }

  return {
    colors: [...colors].sort(),
    sizes: [...sizes].sort()
  };
}

export function buildStockRows(products: Product[]): Array<{
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
  variants: Array<{ code?: string; name: string; stock: number | null; talleId?: number; colorId?: number }>;
}> {
  return products.map((product) => {
    const colors = unique(product.variants.flatMap((variant) => collectColors(product, variant)));
    const sizes = unique(product.variants.flatMap((variant) => collectSizes(product, variant)));
    const raw = product.raw as Record<string, unknown>;
    const articuloId = typeof raw.articuloId === "number" ? raw.articuloId : null;

    return {
      articuloId,
      code: product.code,
      name: product.name,
      description: product.description,
      stock: product.stock ?? null,
      categories: product.categories.map((item) => item.name),
      tags: product.tags.map((item) => item.name),
      price: product.prices[0]?.amount ?? null,
      colors,
      sizes,
      variants: product.variants.map((variant) => {
        const vraw = variant.raw as Record<string, unknown>;
        return {
          code: variant.code ?? variant.sku,
          name: variant.name,
          stock: variant.stock ?? null,
          talleId: typeof vraw.talleId === "number" ? vraw.talleId : undefined,
          colorId: typeof vraw.colorId === "number" ? vraw.colorId : undefined
        };
      })
    };
  });
}

export function filterStockRows(
  rows: ReturnType<typeof buildStockRows>,
  filters: { search?: string; color?: string; size?: string }
): ReturnType<typeof buildStockRows> {
  const search = filters.search?.trim().toLowerCase();
  const color = filters.color?.trim().toLowerCase();
  const size = filters.size?.trim().toLowerCase();

  return rows.filter((row) => {
    const matchesSearch =
      !search ||
      [
        row.code,
        row.name,
        row.description ?? "",
        ...row.categories,
        ...row.tags,
        ...row.variants.map((variant) => [variant.code, variant.name].filter(Boolean).join(" "))
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);

    const matchesColor = !color || row.colors.some((value) => value.toLowerCase() === color);
    const matchesSize = !size || row.sizes.some((value) => value.toLowerCase() === size);

    return matchesSearch && matchesColor && matchesSize;
  });
}
