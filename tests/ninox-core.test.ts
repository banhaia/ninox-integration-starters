import { describe, expect, it } from "vitest";
import { parseNinoxDate, periodRange, shiftPeriod } from "../server/src/ninox/dates.js";
import { parseWaitSeconds, RateLimitedError } from "../server/src/ninox/rate-limiter.js";
import { createTestContext, fixture } from "./helpers.js";

describe("fechas de Ninox", () => {
  it("parsea el formato dd/MM/yyyy HH:mm:ss como UTC", () => {
    expect(parseNinoxDate("05/03/2026 14:20:00")?.toISOString()).toBe("2026-03-05T14:20:00.000Z");
  });

  it("acepta ISO y rechaza basura", () => {
    expect(parseNinoxDate("2026-03-05T10:00:00Z")?.toISOString()).toBe("2026-03-05T10:00:00.000Z");
    expect(parseNinoxDate("no es fecha")).toBeNull();
    expect(parseNinoxDate(null)).toBeNull();
  });

  it("arma rangos de períodos cruzando el año", () => {
    expect(periodRange("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(shiftPeriod("2026-01", -1)).toBe("2025-12");
    expect(shiftPeriod("2026-03", -11)).toBe("2025-04");
  });
});

describe("rate limiter persistido", () => {
  it("respeta la ventana del bucket y la conserva en la base", () => {
    const { ctx, advance } = createTestContext();
    ctx.limiter.take("parametros");
    expect(() => ctx.limiter.take("parametros")).toThrow(RateLimitedError);
    // test = 3 s (+1 s de margen)
    advance(3_000);
    expect(() => ctx.limiter.take("parametros")).toThrow(RateLimitedError);
    advance(1_000);
    expect(() => ctx.limiter.take("parametros")).not.toThrow();
  });

  it("usa ventanas de producción cuando el entorno es prod", () => {
    const { ctx } = createTestContext();
    ctx.settings.saveNinox({ env: "prod" });
    expect(ctx.limiter.windowMs("masivo")).toBe(601_000);
    ctx.settings.saveNinox({ env: "test" });
    expect(ctx.limiter.windowMs("masivo")).toBe(181_000);
    expect(ctx.limiter.windowMs("parametros")).toBe(4_000);
    ctx.settings.saveNinox({ env: "prod" });
    expect(ctx.limiter.windowMs("parametros")).toBe(11_000);
  });

  it("acquire espera en lugar de fallar", async () => {
    const { ctx } = createTestContext();
    ctx.limiter.take("comprobantePaginado");
    await ctx.limiter.acquire("comprobantePaginado");
    expect(ctx.limiter.remainingMs("comprobantePaginado")).toBeGreaterThan(0);
  });

  it("interpreta el mensaje de espera de Ninox", () => {
    expect(parseWaitSeconds("Debe esperar 540 segundos entre cada solicitud")).toBe(540);
    expect(parseWaitSeconds("otro error")).toBeNull();
  });
});

describe("cliente Ninox", () => {
  it("envía el token solo por header y registra la penalidad de un 403 por rate limit", async () => {
    const { ctx, calls, connect } = createTestContext({
      "GET /integraciones/terceros/config": () => ({ body: fixture("config.sample.json") }),
      "GET /integraciones/Terceros/GetData": () => ({ status: 403, body: "Debe esperar 120 segundos entre cada solicitud" })
    });
    connect();

    const config = await ctx.ninox().getConfig();
    expect(config.sucursalesExportacion).toHaveLength(1);
    expect(calls[0].headers["X-NX-TOKEN"]).toBe("token-de-prueba");
    expect(calls[0].query.has("token")).toBe(false);

    await expect(ctx.ninox().getData()).rejects.toBeInstanceOf(RateLimitedError);
    expect(ctx.limiter.remainingMs("masivo")).toBe(121_000);
  });

  it("sin token responde 412", () => {
    const { ctx } = createTestContext();
    expect(() => ctx.ninox()).toThrow(/token/);
  });
});
