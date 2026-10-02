import { Router } from "express";
import type { AppContext } from "../../context.js";
import { HttpError, readInt, readString } from "../../lib/http.js";
import { periodo as toPeriodo, shiftPeriod } from "../../ninox/dates.js";
import { getCoverage, getMonthly, getPaymentMethods, getSucursales, getTopProducts } from "./service.js";

function readPeriodo(value: unknown): string | undefined {
  const text = readString(value);
  if (text === undefined) return undefined;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) throw new HttpError(400, "El período debe tener formato YYYY-MM");
  return text;
}

function currentPeriodo(): string {
  const now = new Date();
  return toPeriodo(now.getFullYear(), now.getMonth() + 1);
}

export function reportsRouter(ctx: AppContext): Router {
  const router = Router();

  router.get("/sucursales", (_req, res) => {
    res.json({ items: getSucursales(ctx.db) });
  });

  router.get("/coverage", (req, res) => {
    res.json(getCoverage(ctx.db, { sucursalId: readInt(req.query.sucursalId) }));
  });

  /** Indicadores mensuales. Por defecto, los últimos 12 meses hasta el mes actual. */
  router.get("/monthly", (req, res) => {
    const hasta = readPeriodo(req.query.hasta) ?? currentPeriodo();
    const desde = readPeriodo(req.query.desde) ?? shiftPeriod(hasta, -11);
    if (desde > hasta) throw new HttpError(400, "desde no puede ser posterior a hasta");
    const filters = { sucursalId: readInt(req.query.sucursalId) };

    res.json({
      desde,
      hasta,
      months: getMonthly(ctx.db, desde, hasta, filters),
      coverage: getCoverage(ctx.db, filters)
    });
  });

  router.get("/top-products", (req, res) => {
    const periodo = readPeriodo(req.query.mes) ?? currentPeriodo();
    res.json({
      periodo,
      items: getTopProducts(ctx.db, periodo, { sucursalId: readInt(req.query.sucursalId) }, readInt(req.query.limit) ?? 10)
    });
  });

  router.get("/payment-methods", (req, res) => {
    const periodo = readPeriodo(req.query.mes) ?? currentPeriodo();
    res.json({ periodo, items: getPaymentMethods(ctx.db, periodo, { sucursalId: readInt(req.query.sucursalId) }) });
  });

  return router;
}
