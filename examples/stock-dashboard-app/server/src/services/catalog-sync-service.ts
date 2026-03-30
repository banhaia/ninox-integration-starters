import type { Product } from "ninox-node-typescript-template";
import { normalizeProducts } from "ninox-node-typescript-template";
import { CatalogRepository } from "./catalog-repository.js";
import type { CatalogSource } from "../sources/catalog-source.js";
import type { SyncState } from "../types/catalog.js";

export class CatalogSyncService {
  private readonly repository: CatalogRepository;
  private readonly sources: CatalogSource[];
  private readonly syncIntervalMs: number;
  private readonly syncState: SyncState;

  constructor(options: {
    repository: CatalogRepository;
    sources: CatalogSource[];
    syncIntervalMs: number;
  }) {
    this.repository = options.repository;
    this.sources = options.sources;
    this.syncIntervalMs = options.syncIntervalMs;
    this.syncState = {
      syncInProgress: false,
      lastSyncAt: null,
      lastSyncSource: null,
      syncError: null,
      configuredSourceIds: this.getConfiguredSources().map((source) => source.id)
    };
  }

  async init(): Promise<void> {
    const snapshot = await this.repository.read();

    this.syncState.lastSyncAt = snapshot.syncedAt;
    this.syncState.lastSyncSource = snapshot.sourceId;
    this.syncState.configuredSourceIds = this.getConfiguredSources().map((source) => source.id);

    if (snapshot.products.length === 0 && this.getConfiguredSources().length > 0) {
      void this.syncNow();
    }

    setInterval(() => {
      void this.syncNow();
    }, this.syncIntervalMs);
  }

  async syncNow(): Promise<{ started: boolean; message: string }> {
    if (this.syncState.syncInProgress) {
      return { started: false, message: "A sync is already in progress." };
    }

    const source = this.getConfiguredSources()[0];
    if (!source) {
      return { started: false, message: "No configured catalog source available." };
    }

    this.syncState.syncInProgress = true;
    this.syncState.syncError = null;

    try {
      const products = await source.fetchProducts();
      await this.persistSnapshot(products, source.id);
      this.syncState.lastSyncAt = new Date().toISOString();
      this.syncState.lastSyncSource = source.id;

      return { started: true, message: `Sync completed from ${source.id}.` };
    } catch (error) {
      this.syncState.syncError = error instanceof Error ? error.message : "Unknown sync error";
      return { started: false, message: this.syncState.syncError };
    } finally {
      this.syncState.syncInProgress = false;
    }
  }

  async getProducts(): Promise<Product[]> {
    const snapshot = await this.repository.read();
    const candidates = snapshot.products.map((product) => {
      if (product && typeof product === "object" && "raw" in product && product.raw) {
        return product.raw;
      }
      return product;
    });

    return normalizeProducts(candidates);
  }

  getStatus(): SyncState & { hasConfiguredSources: boolean } {
    this.syncState.configuredSourceIds = this.getConfiguredSources().map((source) => source.id);

    return {
      ...this.syncState,
      hasConfiguredSources: this.syncState.configuredSourceIds.length > 0
    };
  }

  private getConfiguredSources(): CatalogSource[] {
    return this.sources.filter((source) => source.isConfigured());
  }

  private async persistSnapshot(products: Product[], sourceId: string): Promise<void> {
    const syncedAt = new Date().toISOString();
    await this.repository.write({
      sourceId,
      syncedAt,
      products
    });
  }
}
