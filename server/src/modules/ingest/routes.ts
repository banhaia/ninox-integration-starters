import { Router } from "express";
import type { AppContext } from "../../context.js";
import { currentUser } from "../../auth/require-auth.js";
import { HttpError, readInt, readString } from "../../lib/http.js";
import { periodRange } from "../../ninox/dates.js";
import { handlers, type IngestType } from "./handlers.js";
import type { IngestRunner } from "./runner.js";

/** Tablas que se pueden descargar como CSV desde la base local. */
const EXPORTABLE_TABLES = ["ventas_items", "ventas_totales", "compras_items", "compras_totales"] as const;
type ExportableTable = (typeof EXPORTABLE_TABLES)[number];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function readPeriodo(value: unknown, field: string): string {
  const text = readString(value);
  if (!text || !/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) throw new HttpError(400, `${field} debe tener formato YYYY-MM`);
  return text;
}

export function ingestRouter(ctx: AppContext, runner: IngestRunner): Router {
  const router = Router();

  router.get("/types", (_req, res) => {
    res.json(
      Object.values(handlers).map((h) => ({ type: h.type, label: h.label, group: h.group, enabled: h.enabled, scope: h.scope }))
    );
  });

  router.get("/options", (_req, res) => {
    const stored = ctx.settings.getNinoxConfig();
    res.json({
      configFetchedAt: stored?.fetchedAt ?? null,
      sucursales: stored?.config.sucursalesExportacion ?? [],
      depositos: stored?.config.depositos ?? []
    });
  });

  router.get("/jobs", (req, res) => {
    res.json({ items: runner.list(readInt(req.query.limit) ?? 100) });
  });

  /**
   * Crea un job por tipo y por mes del rango. Cada job usa anio/mes, que no tiene el
   * tope de 30 días del filtro desde/hasta.
   */
  router.post("/jobs", (req, res) => {
    const types = Array.isArray(req.body?.types) ? (req.body.types as unknown[]) : [];
    const validTypes = types.filter((t): t is IngestType => typeof t === "string" && t in handlers);
    if (validTypes.length === 0) throw new HttpError(400, "Elegí al menos un tipo de datos");

    const sucursalId = readInt(req.body?.sucursalId);
    if (!sucursalId) throw new HttpError(400, "Elegí una sucursal");
    const habilitadas = ctx.settings.getNinoxConfig()?.config.sucursalesExportacion;
    if (habilitadas && !habilitadas.some((s) => s.sucursalId === sucursalId)) {
      throw new HttpError(400, "La sucursal no está habilitada para exportar en esta integración");
    }

    const desde = readPeriodo(req.body?.desde, "desde");
    const hasta = readPeriodo(req.body?.hasta ?? req.body?.desde, "hasta");
    if (desde > hasta) throw new HttpError(400, "desde no puede ser posterior a hasta");
    const periodos = periodRange(desde, hasta);
    if (periodos.length > 36) throw new HttpError(400, "El rango máximo es de 36 meses por solicitud");

    const userId = currentUser(res).id;
    const pending = ctx.db.prepare(
      "SELECT 1 FROM ingest_jobs WHERE type = ? AND sucursal_id = ? AND periodo = ? AND status IN ('queued', 'running')"
    );

    const created = [];
    for (const periodo of periodos) {
      for (const type of validTypes) {
        if (pending.get(type, sucursalId, periodo)) continue;
        created.push(runner.enqueue(type, { sucursalId, periodo }, userId));
      }
    }
    res.status(201).json({ items: created });
  });

  router.post("/jobs/:id/cancel", (req, res) => {
    res.json(runner.cancel(readInt(req.params.id) ?? 0));
  });

  router.post("/jobs/:id/retry", (req, res) => {
    res.json(runner.retry(readInt(req.params.id) ?? 0));
  });

  /** Último import exitoso por tipo, sucursal y período. */
  router.get("/coverage", (_req, res) => {
    const rows = ctx.db
      .prepare(
        `SELECT type, sucursal_id AS sucursalId, periodo, MAX(finished_at) AS importedAt,
                (SELECT j2.rows FROM ingest_jobs j2 WHERE j2.type = j.type AND j2.sucursal_id = j.sucursal_id
                   AND j2.periodo = j.periodo AND j2.status = 'done' ORDER BY j2.id DESC LIMIT 1) AS rows
         FROM ingest_jobs j WHERE status = 'done' AND periodo IS NOT NULL
         GROUP BY type, sucursal_id, periodo ORDER BY periodo DESC`
      )
      .all();
    res.json({ items: rows });
  });

  router.get("/export/:table.csv", (req, res) => {
    const table = req.params.table as ExportableTable;
    if (!EXPORTABLE_TABLES.includes(table)) throw new HttpError(404, "Tabla no exportable");

    const desde = readPeriodo(req.query.desde, "desde");
    const hasta = readPeriodo(req.query.hasta ?? req.query.desde, "hasta");
    const sucursalId = readInt(req.query.sucursalId);

    const statement = ctx.db.prepare(
      `SELECT * FROM ${table} WHERE periodo BETWEEN ? AND ? ${sucursalId ? "AND sucursal_id = ?" : ""} ORDER BY fecha_text, factura_id`
    );
    const params: unknown[] = sucursalId ? [desde, hasta, sucursalId] : [desde, hasta];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${table}_${desde}_${hasta}.csv"`);
    res.write("﻿"); // BOM para que Excel detecte UTF-8

    const columns = statement.columns().map((c) => c.name).filter((c) => c !== "job_id");
    res.write(`${columns.join(",")}\n`);
    for (const row of statement.iterate(...params) as Iterable<Record<string, unknown>>) {
      res.write(`${columns.map((c) => csvCell(row[c])).join(",")}\n`);
    }
    res.end();
  });

  return router;
}
