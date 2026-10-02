import type { Product } from "../ninox/product.js";

export interface CatalogSource {
  id: string;
  isConfigured(): boolean;
  fetchProducts(): Promise<Product[]>;
}

