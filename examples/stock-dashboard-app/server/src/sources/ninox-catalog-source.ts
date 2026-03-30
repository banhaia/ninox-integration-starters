import { NinoxClient, normalizeProducts } from "ninox-node-typescript-template";
import type { Product } from "ninox-node-typescript-template";
import type { CatalogSource } from "./catalog-source.js";

export class NinoxCatalogSource implements CatalogSource {
  readonly id = "ninox";

  isConfigured(): boolean {
    return Boolean(process.env.NINOX_BASE_URL?.trim() && process.env.NINOX_TOKEN?.trim());
  }

  async fetchProducts(): Promise<Product[]> {
    const client = new NinoxClient();
    const rawProducts = await client.getProducts();
    return normalizeProducts(rawProducts);
  }
}
