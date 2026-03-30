import { NinoxClient } from "./client/ninoxClient";
import { normalizeProducts } from "./services/productService";

export * from "./client/ninoxClient";
export * from "./services/productService";
export * from "./types/product";

async function main(): Promise<void> {
  const client = new NinoxClient();
  const rawProducts = await client.getProducts();
  const products = normalizeProducts(rawProducts);

  console.log(`Fetched ${products.length} products from Ninox`);
  console.log(JSON.stringify(products.slice(0, 3), null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

