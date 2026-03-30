export interface DashboardSummary {
  hasData: boolean;
  totalProducts: number;
  totalVariants: number;
  totalStock: number;
  outOfStockProducts: number;
  availableColors: number;
  availableSizes: number;
}

export interface SyncStatus {
  configuredSourceIds: string[];
  hasConfiguredSources: boolean;
  syncInProgress: boolean;
  lastSyncAt: string | null;
  lastSyncSource: string | null;
  syncError: string | null;
}

export interface DashboardPayload {
  status: SyncStatus;
  summary: DashboardSummary;
  facets: {
    colors: string[];
    sizes: string[];
  };
}

export interface StockRow {
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
  }>;
}

export interface ProductsPayload {
  items: StockRow[];
  total: number;
  filters: {
    search: string;
    color: string;
    size: string;
  };
  facets: {
    colors: string[];
    sizes: string[];
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getDashboard(): Promise<DashboardPayload> {
  return request("/api/dashboard");
}

export function getProducts(params: URLSearchParams): Promise<ProductsPayload> {
  return request(`/api/products?${params.toString()}`);
}

export function triggerSync(): Promise<{ started: boolean; message: string }> {
  return request("/api/sync", {
    method: "POST"
  });
}
