import type { Category, Price, Product, Tag, Variant } from "../types/product";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstDefined<T>(...values: T[]): T | undefined {
  return values.find((value) => value !== undefined && value !== null);
}

function notNull<T>(value: T | null): value is T {
  return value !== null;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function normalizeNamedItems<T extends Category | Tag>(
  value: unknown,
  fallbackPrefix: string
): T[] {
  return asArray(value)
    .map((item, index) => {
      if (typeof item === "string") {
        return { name: item.trim(), code: `${fallbackPrefix}-${index + 1}` } as T;
      }

      if (!isRecord(item)) {
        return null;
      }

      const name = firstString(item.name, item.nombre, item.descripcion, item.description);
      if (!name) {
        return null;
      }

      return {
        id: firstString(item.id, item._id),
        code: firstString(item.code, item.codigo, item.cod),
        name
      } as T;
    })
    .filter((item): item is T => Boolean(item));
}

function uniqueByName<T extends Category | Tag>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.code ?? ""}::${item.name.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeTagCollections(raw: Record<string, unknown>): {
  categories: Category[];
  tags: Tag[];
} {
  type NestedTag = {
    kind: "category" | "tag";
    value: {
      id?: string;
      code?: string;
      name: string;
    };
  };

  const directCategories = normalizeNamedItems<Category>(
    firstDefined(raw.categories, raw.categorias, raw.rubros),
    "category"
  );
  const directTags = normalizeNamedItems<Tag>(
    firstDefined(raw.tags, raw.etiquetas, raw.labels),
    "tag"
  );

  const nestedTags = asArray(raw.tags).flatMap<NestedTag>((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const name = firstString(item.tagNombre, item.nombre, item.name);
    if (!name) {
      return [];
    }

    const normalized = {
      id: firstString(item.articuloTagId, item.tagId, item.id, item._id),
      code: firstString(item.tagCodigo, item.codigo, item.code),
      name
    };

    return Number(item.tipo) === 1
      ? [{ kind: "category" as const, value: normalized }]
      : [{ kind: "tag" as const, value: normalized }];
  });

  return {
    categories: uniqueByName([
      ...directCategories,
      ...nestedTags
        .filter((item): item is NestedTag & { kind: "category" } => item.kind === "category")
        .map((item) => item.value)
    ]),
    tags: uniqueByName([
      ...directTags,
      ...nestedTags
        .filter((item): item is NestedTag & { kind: "tag" } => item.kind === "tag")
        .map((item) => item.value)
    ])
  };
}

function normalizePrices(value: unknown): Price[] {
  const items = asArray(value);

  if (items.length === 0) {
    const singleAmount = firstNumber(value);
    return singleAmount === undefined ? [] : [{ amount: singleAmount }];
  }

  const normalized = items.map<Price | null>((item) => {
      if (typeof item === "number") {
        return { amount: item };
      }

      if (typeof item === "string") {
        const parsed = Number(item);
        return Number.isFinite(parsed) ? { amount: parsed } : null;
      }

      if (!isRecord(item)) {
        return null;
      }

      const amount = firstNumber(
        item.amount,
        item.value,
        item.precio,
        item.price,
        item.importe,
        item.monto
      );

      if (amount === undefined) {
        return null;
      }

      return {
        amount,
        currency: firstString(item.currency, item.moneda),
        label: firstString(item.label, item.nombre, item.name, item.tipo),
        raw: item
      };
    });

  return normalized.filter(notNull);
}

function normalizeProductPrices(raw: Record<string, unknown>): Price[] {
  const directPrices = normalizePrices(firstDefined(raw.prices, raw.precios, raw.price, raw.precio));
  if (directPrices.length > 0) {
    return directPrices;
  }

  const fallbackPrices = [
    { label: "precioVenta", amount: firstNumber(raw.precioVenta) },
    { label: "precio1", amount: firstNumber(raw.precio1) },
    { label: "precio2", amount: firstNumber(raw.precio2) },
    { label: "precio3", amount: firstNumber(raw.precio3) },
    { label: "precio4", amount: firstNumber(raw.precio4) },
    { label: "precio5", amount: firstNumber(raw.precio5) }
  ]
    .filter((item) => item.amount !== undefined && (item.amount ?? 0) > 0)
    .map((item) => ({
      amount: item.amount as number,
      label: item.label
    }));

  return fallbackPrices;
}

function normalizeVariants(value: unknown): Variant[] {
  const normalized = asArray(value).map<Variant | null>((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const name = firstString(
        item.name,
        item.nombre,
        item.descripcion,
        item.description,
        item.valor
      );

      if (!name) {
        return null;
      }

      return {
        id: firstString(item.id, item._id),
        code: firstString(item.code, item.codigo, item.cod),
        sku: firstString(item.sku),
        name,
        stock: firstDefined(
          firstNumber(item.stock, item.stockDisponible, item.disponible),
          null
        ),
        prices: normalizePrices(firstDefined(item.prices, item.precios, item.price, item.precio)),
        raw: item
      };
    });

  return normalized.filter(notNull);
}

function normalizeCurveVariants(raw: Record<string, unknown>, basePrices: Price[]): Variant[] {
  const curve = asArray(raw.curva);
  if (curve.length === 0) {
    return [];
  }

  return curve
    .map<Variant | null>((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const colorName = firstString(item.colorNombre, item.color, item.colour);
      const sizeName = firstString(item.talleNombre, item.talle, item.size, item.talla);
      const stock =
        firstNumber(item.unidades, item.cantidad, item.total, item.stock, item.stockCantidad) ?? 0;

      const parts = [colorName, sizeName].filter(Boolean);
      if (parts.length === 0) {
        return null;
      }

      return {
        id: firstString(item.articuloCurvaId, item.id, item._id),
        code: firstString(item.codigoCurva, item.codigoBarras),
        sku: firstString(item.codigoCurva, item.codigoBarras),
        name: parts.join(" / "),
        stock,
        prices: basePrices,
        raw: item
      };
    })
    .filter(notNull);
}

function getProductName(raw: Record<string, unknown>): string {
  return (
    firstString(raw.name, raw.nombre, raw.descripcion, raw.description, raw.title) ??
    "Producto sin nombre"
  );
}

function getProductCode(raw: Record<string, unknown>, index: number): string {
  return (
    firstString(raw.code, raw.codigo, raw.cod, raw.sku, raw.id, raw._id) ??
    `product-${index + 1}`
  );
}

export function normalizeProducts(input: unknown[]): Product[] {
  const normalized = input.map<Product | null>((item, index) => {
      if (!isRecord(item)) {
        return null;
      }

      const { categories, tags } = normalizeTagCollections(item);
      const prices = normalizeProductPrices(item);
      const directVariants = normalizeVariants(firstDefined(item.variants, item.variantes));
      const variants = directVariants.length > 0 ? directVariants : normalizeCurveVariants(item, prices);

      return {
        id: firstString(item.id, item._id, item.articuloId),
        code: getProductCode(item, index),
        name: getProductName(item),
        description: firstString(item.description, item.descripcion, item.descripcionWeb, item.descripcionLarga, item.detalle),
        categories,
        tags,
        prices,
        variants,
        stock: firstDefined(
          firstNumber(
            item.stock,
            item.stockDisponible,
            item.disponible,
            item.existencia,
            item.stockCantidad,
            item.stockTotal
          ),
          null
        ),
        raw: item
      } satisfies Product;
    });

  return normalized.filter(notNull);
}

export function searchProducts(products: Product[], query: string): Product[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return products;
  }

  return products.filter((product) => {
    const haystack = [
      product.code,
      product.name,
      product.description ?? "",
      ...product.categories.map((category) => category.name),
      ...product.tags.map((tag) => tag.name),
      ...product.variants.map((variant) => [variant.code, variant.sku, variant.name].join(" "))
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function filterProducts(
  products: Product[],
  filters: { category?: string; tag?: string }
): Product[] {
  const category = filters.category?.trim().toLowerCase();
  const tag = filters.tag?.trim().toLowerCase();

  return products.filter((product) => {
    const categoryMatches =
      !category ||
      product.categories.some((item) =>
        [item.name, item.code].filter(Boolean).join(" ").toLowerCase().includes(category)
      );

    const tagMatches =
      !tag ||
      product.tags.some((item) =>
        [item.name, item.code].filter(Boolean).join(" ").toLowerCase().includes(tag)
      );

    return categoryMatches && tagMatches;
  });
}
