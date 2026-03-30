const { NinoxClient, normalizeProducts } = require("../../templates/node-typescript/dist");

function mapToStoreItem(product) {
  return {
    sku: product.code,
    title: product.name,
    description: product.description ?? "",
    categories: product.categories.map((item) => item.name),
    tags: product.tags.map((item) => item.name),
    price: product.prices[0]?.amount ?? null,
    stock: product.stock,
    variants: product.variants.map((variant) => ({
      sku: variant.code ?? variant.sku ?? variant.name,
      title: variant.name,
      stock: variant.stock,
      price: variant.prices[0]?.amount ?? null
    }))
  };
}

async function main() {
  const client = new NinoxClient();
  const rawProducts = await client.getProducts();
  const products = normalizeProducts(rawProducts);
  const storefrontItems = products.map(mapToStoreItem);

  console.log(JSON.stringify(storefrontItems.slice(0, 10), null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

