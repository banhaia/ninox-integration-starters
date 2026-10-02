import fs from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import type { AppContext } from "./context.js";
import { requireAuth } from "./auth/require-auth.js";
import { errorMiddleware, HttpError } from "./lib/http.js";
import { NinoxApiError, NinoxNetworkError } from "./ninox/client.js";
import { RateLimitedError } from "./ninox/rate-limiter.js";
import { authRouter } from "./modules/auth/routes.js";
import { catalogRouter } from "./modules/catalog/routes.js";
import { CatalogSyncService } from "./modules/catalog/sync-service.js";
import { ingestRouter } from "./modules/ingest/routes.js";
import { IngestRunner } from "./modules/ingest/runner.js";
import { ordersRouter } from "./modules/orders/routes.js";
import { reportsRouter } from "./modules/reports/routes.js";
import { settingsRouter } from "./modules/settings/routes.js";

export interface AppServices {
  catalogSync: CatalogSyncService;
  ingest: IngestRunner;
}

/** Traduce errores de la integración a respuestas HTTP entendibles para la UI. */
function ninoxErrorMiddleware(error: unknown, _req: Request, _res: Response, next: NextFunction): void {
  if (error instanceof RateLimitedError) {
    next(new HttpError(429, error.message, { retryAfterSeconds: error.retryAfterSeconds, bucket: error.bucket }));
  } else if (error instanceof NinoxApiError) {
    next(new HttpError(502, error.message, { ninoxStatus: error.status }));
  } else if (error instanceof NinoxNetworkError) {
    next(new HttpError(error.timedOut ? 504 : 502, error.message));
  } else {
    next(error);
  }
}

export function createApp(ctx: AppContext, services: AppServices, options: { clientDistPath?: string } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  // Log mínimo: método, ruta sin query, status y duración. Nunca bodies (pueden tener datos personales).
  app.use((req, res, next) => {
    const started = Date.now();
    const pathname = req.originalUrl.split("?")[0];
    res.on("finish", () => {
      if (pathname.startsWith("/api") && pathname !== "/api/auth/status") {
        console.log(`[http] ${req.method} ${pathname} → ${res.statusCode} (${Date.now() - started}ms)`);
      }
    });
    next();
  });

  const api = express.Router();
  api.use("/auth", authRouter(ctx.db, ctx.secureCookies));
  api.use(requireAuth(ctx.db, ctx.secureCookies));
  api.use("/settings", settingsRouter(ctx));
  api.use(catalogRouter(ctx, services.catalogSync));
  api.use(ordersRouter(ctx));
  api.use("/ingest", ingestRouter(ctx, services.ingest));
  api.use("/reports", reportsRouter(ctx));
  api.use((_req, _res, next) => next(new HttpError(404, "Ruta no encontrada")));

  app.use("/api", api);

  if (options.clientDistPath && fs.existsSync(options.clientDistPath)) {
    const dist = options.clientDistPath;
    app.use(express.static(dist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(path.join(dist, "index.html"));
    });
  }

  app.use(ninoxErrorMiddleware);
  app.use(errorMiddleware);
  return app;
}
