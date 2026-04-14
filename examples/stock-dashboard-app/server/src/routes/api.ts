import { Router } from "express";
import {
  buildFacets,
  buildStockRows,
  buildSummary,
  filterStockRows
} from "../services/catalog-query-service.js";
import { catalogSyncService } from "../services/container.js";
import { NinoxApiError, NinoxClient } from "ninox-node-typescript-template";
import { validateSaleBody } from "../types/preventas.js";
import { appendHistoryEntry, getHistory } from "../services/preventa-history-service.js";

export const apiRouter = Router();

// ── Medios de pago cache ──────────────────────────────────────────────────────
// Ninox enforces a rate limit on this endpoint. A single in-memory entry
// absorbs React StrictMode's double-mount effect and repeated navigation.
const MEDIOS_PAGO_TTL_MS = 10 * 60 * 1000; // 10 minutes
let mediosPagoCache: { data: unknown; expiresAt: number } | null = null;
// ─────────────────────────────────────────────────────────────────────────────

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

apiRouter.get("/medios-pago", async (_request, response) => {
  if (mediosPagoCache && Date.now() < mediosPagoCache.expiresAt) {
    response.json(mediosPagoCache.data);
    return;
  }
  try {
    const client = new NinoxClient();
    const data = await client.getMediosPago();
    mediosPagoCache = { data, expiresAt: Date.now() + MEDIOS_PAGO_TTL_MS };
    response.json(data);
  } catch (error) {
    if (error instanceof NinoxApiError) {
      response.status(502).json({ error: error.message, status: error.status });
    } else {
      response.status(500).json({ error: "Error interno al obtener medios de pago" });
    }
  }
});

// Ambos endpoints del frontend (preventa y venta) usan el mismo /Pedido de Ninox.
// El comportamiento (preventa vs venta directa) está determinado por la configuración del token.
async function handlePedido(
  type: "preventa" | "venta",
  request: import("express").Request,
  response: import("express").Response
): Promise<void> {
  const errors = validateSaleBody(request.body);
  if (Object.keys(errors).length > 0) {
    response.status(400).json({ errors });
    return;
  }
  try {
    const client = new NinoxClient();
    const result = await client.createPedido(request.body);
    appendHistoryEntry(type, request.body, result);
    response.status(201).json(result);
  } catch (error) {
    if (error instanceof NinoxApiError) {
      console.error(`[${type}] NinoxApiError`, error.status, error.body);
      response.status(502).json({ error: error.message, status: error.status, body: error.body });
    } else {
      console.error(`[${type}] unexpected error:`, error);
      const msg = error instanceof Error ? error.message : String(error);
      response.status(500).json({ error: `Error interno al crear ${type}: ${msg}` });
    }
  }
}

apiRouter.post("/preventas", (req, res) => handlePedido("preventa", req, res));
apiRouter.post("/ventas", (req, res) => handlePedido("venta", req, res));

apiRouter.get("/preventa-history", (_request, response) => {
  response.json(getHistory());
});
