const { NinoxClient } = require("../../templates/node-typescript/dist");

async function main() {
  const client = new NinoxClient();
  const orderPayload = {
    externalId: `demo-${Date.now()}`,
    customer: {
      name: "Cliente Demo",
      email: "demo@example.com"
    },
    notes: "Pedido de ejemplo para completar cuando se confirme el endpoint real.",
    items: [
      {
        productCode: "SKU-001",
        quantity: 1
      }
    ]
  };

  console.log("Prepared order payload:");
  console.log(JSON.stringify(orderPayload, null, 2));

  await client.createOrder(orderPayload);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

