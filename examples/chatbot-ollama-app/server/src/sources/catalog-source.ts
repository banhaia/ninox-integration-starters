import type { Product } from "ninox-node-typescript-template";

export interface CatalogSource {
  id: string;
  isConfigured(): boolean;
  fetchProducts(): Promise<Product[]>;
}

