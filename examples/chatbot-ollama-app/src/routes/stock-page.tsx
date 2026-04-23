import { StockCatalogView } from "@ninox/stock-ui";
import { getStockProducts } from "@/lib/api";

export function StockPage(): JSX.Element {
  return (
    <StockCatalogView
      loadProducts={getStockProducts}
      title="Stock cargado"
      description="Catalogo sincronizado que el bot usa como contexto para responder disponibilidad."
    />
  );
}
