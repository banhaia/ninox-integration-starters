import { Router } from "express";
import type { AppContext } from "../../context.js";
import { currentUser } from "../../auth/require-auth.js";
import { asyncHandler, HttpError, readInt } from "../../lib/http.js";
import { OrdersService, type OrderStatus } from "./service.js";
import type { OrderKind } from "./validation.js";

const MEDIOS_CACHE_MS = 10 * 60 * 1000;

function readKind(value: unknown): OrderKind | undefined {
  return value === "preventa" || value === "venta" ? value : undefined;
}

function readStatus(value: unknown): OrderStatus | undefined {
  return ["pending", "created", "failed", "unknown", "cancelled"].includes(String(value))
    ? (value as OrderStatus)
    : undefined;
}

function readId(value: unknown): number {
  const id = readInt(value);
  if (!id) throw new HttpError(400, "Id inválido");
  return id;
}

export function ordersRouter(ctx: AppContext): Router {
  const router = Router();
  const service = new OrdersService(ctx);
  let mediosCache: { at: number; data: unknown } | null = null;

  router.get("/medios-pago", asyncHandler(async (_req, res) => {
    if (!mediosCache || Date.now() - mediosCache.at > MEDIOS_CACHE_MS) {
      mediosCache = { at: Date.now(), data: await ctx.ninox().getMediosPago() };
    }
    res.json(mediosCache.data);
  }));

  router.get("/orders", (req, res) => {
    res.json({
      items: service.list({
        kind: readKind(req.query.kind),
        status: readStatus(req.query.status),
        limit: readInt(req.query.limit)
      })
    });
  });

  router.get("/orders/next-orden-id", (_req, res) => {
    res.json({ ordenId: service.nextOrdenId() });
  });

  router.get("/orders/:id", (req, res) => {
    res.json(service.get(readId(req.params.id)));
  });

  router.post("/orders/:kind(preventa|venta)", asyncHandler(async (req, res) => {
    const kind = readKind(req.params.kind) ?? "preventa";
    const order = await service.create(kind, req.body, currentUser(res).id);
    res.status(order.status === "created" ? 201 : 200).json(order);
  }));

  router.post("/orders/:id/retry", asyncHandler(async (req, res) => {
    res.json(await service.retry(readId(req.params.id)));
  }));

  router.post("/orders/:id/cancel", asyncHandler(async (req, res) => {
    res.json(await service.cancel(readId(req.params.id)));
  }));

  router.get("/orders/:id/comprobante", asyncHandler(async (req, res) => {
    res.json(await service.comprobante(readId(req.params.id)));
  }));

  return router;
}
