import { NinoxCatalogSource } from "../sources/ninox-catalog-source.js";
import { StockRepository } from "./stock-repository.js";
import { StockSyncService } from "./stock-sync-service.js";

const syncIntervalMs = Number(process.env.CATALOG_SYNC_INTERVAL_MS ?? 600000);

export const stockSyncService = new StockSyncService({
  repository: new StockRepository(),
  sources: [new NinoxCatalogSource()],
  syncIntervalMs: Number.isFinite(syncIntervalMs) && syncIntervalMs > 0 ? syncIntervalMs : 600000
});

