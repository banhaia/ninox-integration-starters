import { StockCatalogView } from "@/components/stock/stock-catalog-view";
import { getProducts } from "@/lib/api";

export function StockPage() {
  return (
    <StockCatalogView
      loadProducts={getProducts}
      description="Catálogo sincronizado desde Ninox y guardado en SQLite. Buscá por código, nombre, categoría o código de barras."
      emptyMessage="No hay artículos para esos filtros. Si la base está vacía, sincronizá el catálogo desde Inicio."
    />
  );
}
