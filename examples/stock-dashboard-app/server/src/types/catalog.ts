import type { Product } from "ninox-node-typescript-template";

export interface CatalogSnapshot {
  sourceId: string | null;
  syncedAt: string | null;
  products: Product[];
}

export interface SyncState {
  syncInProgress: boolean;
  lastSyncAt: string | null;
  lastSyncSource: string | null;
  syncError: string | null;
  configuredSourceIds: string[];
}
