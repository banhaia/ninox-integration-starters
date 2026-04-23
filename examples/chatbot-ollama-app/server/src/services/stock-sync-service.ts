import type { Product } from "ninox-node-typescript-template";
import { normalizeProducts } from "ninox-node-typescript-template";
import type { CatalogSource } from "../sources/catalog-source.js";
import type { StockSyncState } from "../types/stock.js";
import { StockRepository } from "./stock-repository.js";

export class StockSyncService {
  private readonly repository: StockRepository;
  private readonly sources: CatalogSource[];
  private readonly syncIntervalMs: number;
  private readonly syncState: StockSyncState;

  constructor(options: {
    repository: StockRepository;
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
      return { started: false, message: "A stock sync is already in progress." };
    }

    const source = this.getConfiguredSources()[0];
    if (!source) {
      return { started: false, message: "No configured stock source available." };
    }

    this.syncState.syncInProgress = true;
    this.syncState.syncError = null;

    try {
      const products = await source.fetchProducts();
      const syncedAt = new Date().toISOString();

      await this.repository.write({
        sourceId: source.id,
        syncedAt,
        products
      });

      this.syncState.lastSyncAt = syncedAt;
      this.syncState.lastSyncSource = source.id;

      return { started: true, message: `Stock sync completed from ${source.id}.` };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown stock sync error";
      this.syncState.syncError = message;

      console.error("[stock-sync] Error al sincronizar stock:");
      console.error("  message:", message);
      if (error instanceof Error && error.cause) {
        console.error("  cause:", error.cause);
      }
      if (error instanceof Error && error.stack) {
        console.error("  stack:", error.stack);
      }

      return { started: false, message };
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

  async getStatus(): Promise<StockSyncState & {
    hasConfiguredSources: boolean;
    productCount: number;
  }> {
    const snapshot = await this.repository.read();
    this.syncState.configuredSourceIds = this.getConfiguredSources().map((source) => source.id);

    return {
      ...this.syncState,
      hasConfiguredSources: this.syncState.configuredSourceIds.length > 0,
      productCount: snapshot.products.length
    };
  }

  private getConfiguredSources(): CatalogSource[] {
    return this.sources.filter((source) => source.isConfigured());
  }
}

