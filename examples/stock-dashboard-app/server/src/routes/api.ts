import { Router } from "express";
import {
  buildFacets,
  buildStockRows,
  buildSummary,
  filterStockRows
} from "../services/catalog-query-service.js";
import { catalogSyncService } from "../services/container.js";

export const apiRouter = Router();

apiRouter.get("/dashboard", async (_request, response) => {
  const products = await catalogSyncService.getProducts();

  response.json({
    status: catalogSyncService.getStatus(),
    summary: buildSummary(products),
    facets: buildFacets(products)
  });
});

apiRouter.get("/products", async (request, response) => {
  const products = await catalogSyncService.getProducts();
  const rows = buildStockRows(products);
  const filtered = filterStockRows(rows, {
    search: typeof request.query.search === "string" ? request.query.search : "",
    color: typeof request.query.color === "string" ? request.query.color : "",
    size: typeof request.query.size === "string" ? request.query.size : ""
  });

  response.json({
    items: filtered,
    total: filtered.length,
    filters: {
      search: typeof request.query.search === "string" ? request.query.search : "",
      color: typeof request.query.color === "string" ? request.query.color : "",
      size: typeof request.query.size === "string" ? request.query.size : ""
    },
    facets: buildFacets(products)
  });
});

apiRouter.post("/sync", async (_request, response) => {
  const result = await catalogSyncService.syncNow();
  response.status(result.started ? 202 : 409).json(result);
});
