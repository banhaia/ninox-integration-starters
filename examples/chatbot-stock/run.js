const { NinoxClient, normalizeProducts, searchProducts } = require("../../templates/node-typescript/dist");

async function main() {
  const query = process.argv.slice(2).join(" ").trim();

  if (!query) {
    console.error("Usage: node ../../examples/chatbot-stock/run.js <texto>");
    process.exit(1);
  }

  const client = new NinoxClient();
  const rawProducts = await client.getProducts();
  const products = normalizeProducts(rawProducts);
  const matches = searchProducts(products, query).slice(0, 5);

  if (matches.length === 0) {
    console.log(`No products found for "${query}"`);
    return;
  }

  for (const product of matches) {
    console.log(
      JSON.stringify(
        {
          code: product.code,
          name: product.name,
          stock: product.stock,
          prices: product.prices,
          variants: product.variants.map((variant) => ({
            code: variant.code,
            name: variant.name,
            stock: variant.stock
          }))
        },
        null,
        2
      )
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

