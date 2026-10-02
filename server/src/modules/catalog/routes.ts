import { Router } from "express";
import type { AppContext } from "../../context.js";
import { asyncHandler, readInt, readString } from "../../lib/http.js";
import { getFacets, getSummary, listStockRows } from "./repository.js";
import type { CatalogSyncService } from "./sync-service.js";

export function catalogRouter(ctx: AppContext, sync: CatalogSyncService): Router {
  const router = Router();

  router.get("/dashboard", (_req, res) => {
    res.json({ status: sync.status(), summary: getSummary(ctx.db), facets: getFacets(ctx.db) });
  });

  router.get("/products", (req, res) => {
    const filters = {
      search: readString(req.query.search),
      color: readString(req.query.color),
      size: readString(req.query.size),
      limit: readInt(req.query.limit)
    };
    const { items, total } = listStockRows(ctx.db, filters);
    res.json({
      items,
      total,
      filters: { search: filters.search ?? "", color: filters.color ?? "", size: filters.size ?? "" },
      facets: getFacets(ctx.db)
    });
  });

  router.get("/catalog/status", (_req, res) => {
    res.json(sync.status());
  });

  router.post(
    "/catalog/sync",
    asyncHandler(async (_req, res) => {
      const result = await sync.sync("manual");
      res.json({ ok: true, ...result, status: sync.status() });
    })
  );

  return router;
}
