import { Router } from "express";
import type { AppContext } from "../../context.js";
import { asyncHandler, HttpError, readInt, readString } from "../../lib/http.js";
import type { NinoxEnv } from "../../config.js";

function readEnv(value: unknown): NinoxEnv | undefined {
  return value === "test" || value === "prod" || value === "custom" ? value : undefined;
}

export function settingsRouter(ctx: AppContext): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({
      ninox: ctx.settings.view(),
      ninoxConfig: ctx.settings.getNinoxConfig(),
      rateLimits: ctx.limiter.status()
    });
  });

  router.put("/ninox", (req, res) => {
    const env = readEnv(req.body?.env);
    if (req.body?.env !== undefined && !env) throw new HttpError(400, "Entorno inválido (test | prod | custom)");

    const baseUrl = typeof req.body?.baseUrl === "string" ? (req.body.baseUrl as string) : undefined;
    if (baseUrl && !/^https?:\/\/[^\s]+$/i.test(baseUrl.trim())) {
      throw new HttpError(400, "La URL base debe empezar con http:// o https://");
    }
    if (env === "custom" && !baseUrl?.trim() && !ctx.settings.getConnection().baseUrl) {
      throw new HttpError(400, "Con entorno custom tenés que indicar la URL base");
    }

    ctx.settings.saveNinox({
      env,
      baseUrl,
      token: readString(req.body?.token),
      clearToken: req.body?.clearToken === true
    });
    res.json({ ninox: ctx.settings.view() });
  });

  /** Prueba la conexión con GET /config y guarda la configuración de la integración. */
  router.post(
    "/ninox/test",
    asyncHandler(async (_req, res) => {
      const config = await ctx.ninox().getConfig();
      const stored = ctx.settings.setNinoxConfig(config);
      res.json({ ok: true, ninoxConfig: stored });
    })
  );

  router.put("/orders", (req, res) => {
    const ordenIdBase = readInt(req.body?.ordenIdBase);
    if (!ordenIdBase || ordenIdBase < 1) throw new HttpError(400, "ordenIdBase debe ser un entero positivo");
    ctx.settings.setOrdenIdBase(ordenIdBase);
    res.json({ ninox: ctx.settings.view() });
  });

  return router;
}
