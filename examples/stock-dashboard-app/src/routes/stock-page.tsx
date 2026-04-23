import { StockCatalogView } from "@ninox/stock-ui";
import { getProducts } from "@/lib/api";

export function StockPage(): JSX.Element {
  return <StockCatalogView loadProducts={getProducts} />;
}
