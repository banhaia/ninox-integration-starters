import type { Product } from "../ninox/product.js";

export interface StockSnapshot {
  sourceId: string | null;
  syncedAt: string | null;
  products: Product[];
}

export interface StockSyncState {
  syncInProgress: boolean;
  lastSyncAt: string | null;
  lastSyncSource: string | null;
  syncError: string | null;
  configuredSourceIds: string[];
}

