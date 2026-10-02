import { StockCatalogView } from "@/components/stock/stock-catalog-view";
import { getStockProducts } from "@/lib/api";

export function StockPage() {
  return (
    <StockCatalogView
      loadProducts={getStockProducts}
      title="Stock cargado"
      description="Catalogo sincronizado que el bot usa como contexto para responder disponibilidad."
    />
  );
}
