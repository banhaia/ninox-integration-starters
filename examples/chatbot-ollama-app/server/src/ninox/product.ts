export interface Category {
  id?: string;
  code?: string;
  name: string;
}

export interface Tag {
  id?: string;
  code?: string;
  name: string;
}

export interface Price {
  currency?: string;
  amount: number;
  label?: string;
  raw?: unknown;
}

export interface Variant {
  id?: string;
  code?: string;
  sku?: string;
  name: string;
  stock?: number | null;
  prices: Price[];
  raw?: unknown;
}

export interface Product {
  id?: string;
  code: string;
  name: string;
  description?: string;
  categories: Category[];
  tags: Tag[];
  prices: Price[];
  variants: Variant[];
  stock?: number | null;
  raw?: unknown;
}

export interface OrderItemInput {
  productCode: string;
  quantity: number;
  variantCode?: string;
  price?: number;
}

export interface CreateOrderInput {
  externalId?: string;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    document?: string;
  };
  notes?: string;
  items: OrderItemInput[];
  raw?: unknown;
}

