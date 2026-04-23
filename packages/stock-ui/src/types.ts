export interface StockFacets {
  colors: string[];
  sizes: string[];
}

export interface StockFilters {
  search: string;
  color: string;
  size: string;
}

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
  variants: Array<{
    code?: string;
    name: string;
    stock: number | null;
    talleId?: number;
    colorId?: number;
  }>;
}

export interface ProductsPayload {
  items: StockRow[];
  total: number;
  filters: StockFilters;
  facets: StockFacets;
}

export interface StockCatalogViewProps {
  loadProducts: (params: URLSearchParams) => Promise<ProductsPayload>;
  title?: string;
  description?: string;
  emptyMessage?: string;
}
