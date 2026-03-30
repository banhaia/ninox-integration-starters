import { CatalogRepository } from "./catalog-repository.js";
import { CatalogSyncService } from "./catalog-sync-service.js";
import { NinoxCatalogSource } from "../sources/ninox-catalog-source.js";

const syncIntervalMs = Number(process.env.CATALOG_SYNC_INTERVAL_MS ?? 600000);

export const catalogSyncService = new CatalogSyncService({
  repository: new CatalogRepository(),
  sources: [new NinoxCatalogSource()],
  syncIntervalMs: Number.isFinite(syncIntervalMs) && syncIntervalMs > 0 ? syncIntervalMs : 600000
});
