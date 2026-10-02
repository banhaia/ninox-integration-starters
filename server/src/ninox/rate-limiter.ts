import type { Db } from "../db/connection.js";
import type { NinoxEnv } from "../config.js";

/**
 * Buckets de rate limit de la API de terceros (ver docs/modules/cliente-ninox.md).
 * Varios endpoints comparten ventana: por ejemplo GetData y exportar/stock usan el
 * mismo bucket "masivo", así que un sync de catálogo bloquea un export de stock.
 */
export type RateBucket = "masivo" | "comprobantePaginado" | "saldos" | "parametros" | "comprobante" | "entidades";

const WINDOWS_SECONDS: Record<RateBucket, { test: number; prod: number }> = {
  masivo: { test: 180, prod: 600 },
  comprobantePaginado: { test: 3, prod: 30 },
  saldos: { test: 3, prod: 10 },
  parametros: { test: 3, prod: 10 },
  comprobante: { test: 3, prod: 10 },
  entidades: { test: 3, prod: 10 }
};

/** Margen para no pegarle a Ninox justo en el borde de la ventana. */
const SAFETY_MARGIN_MS = 1000;

export class RateLimitedError extends Error {
  readonly bucket: RateBucket;
  readonly retryAfterSeconds: number;

  constructor(bucket: RateBucket, retryAfterSeconds: number) {
    super(`Ninox limita esta consulta: esperá ${retryAfterSeconds} segundos antes de reintentar.`);
    this.name = "RateLimitedError";
    this.bucket = bucket;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface RateLimiterOptions {
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Cancelado"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("Cancelado"));
      },
      { once: true }
    );
  });
}

/**
 * Rate limiter persistido en SQLite: la ventana sobrevive reinicios del server,
 * así un restart no dispara un 403 de Ninox.
 */
export class RateLimiter {
  private readonly now: () => number;
  private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>;

  constructor(
    private readonly db: Db,
    private readonly getEnv: () => NinoxEnv,
    options: RateLimiterOptions = {}
  ) {
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? defaultSleep;
  }

  windowMs(bucket: RateBucket): number {
    const windows = WINDOWS_SECONDS[bucket];
    return (this.getEnv() === "prod" ? windows.prod : windows.test) * 1000 + SAFETY_MARGIN_MS;
  }

  remainingMs(bucket: RateBucket): number {
    const row = this.db.prepare("SELECT next_allowed_at FROM api_rate_buckets WHERE bucket = ?").get(bucket) as
      | { next_allowed_at: number }
      | undefined;
    return row ? Math.max(0, row.next_allowed_at - this.now()) : 0;
  }

  /** Para acciones manuales: si la ventana no está libre, falla con los segundos restantes. */
  take(bucket: RateBucket): void {
    const remaining = this.remainingMs(bucket);
    if (remaining > 0) throw new RateLimitedError(bucket, Math.ceil(remaining / 1000));
    this.reserve(bucket, this.windowMs(bucket));
  }

  /** Para procesos en segundo plano (ingesta): espera a que la ventana se libere. */
  async acquire(bucket: RateBucket, signal?: AbortSignal): Promise<void> {
    for (;;) {
      const remaining = this.remainingMs(bucket);
      if (remaining <= 0) break;
      await this.sleep(remaining, signal);
    }
    this.reserve(bucket, this.windowMs(bucket));
  }

  /** Ninox respondió 403 "Debe esperar N segundos": se respeta ese valor. */
  penalize(bucket: RateBucket, seconds: number): void {
    this.reserve(bucket, seconds * 1000 + SAFETY_MARGIN_MS);
  }

  status(): Array<{ bucket: RateBucket; remainingSeconds: number; windowSeconds: number }> {
    return (Object.keys(WINDOWS_SECONDS) as RateBucket[]).map((bucket) => ({
      bucket,
      remainingSeconds: Math.ceil(this.remainingMs(bucket) / 1000),
      windowSeconds: Math.round((this.windowMs(bucket) - SAFETY_MARGIN_MS) / 1000)
    }));
  }

  private reserve(bucket: RateBucket, ms: number): void {
    const now = this.now();
    this.db
      .prepare(
        `INSERT INTO api_rate_buckets (bucket, next_allowed_at, last_request_at) VALUES (?, ?, ?)
         ON CONFLICT(bucket) DO UPDATE SET next_allowed_at = excluded.next_allowed_at, last_request_at = excluded.last_request_at`
      )
      .run(bucket, now + ms, now);
  }
}

/** Extrae N de "Debe esperar N segundos entre cada solicitud". */
export function parseWaitSeconds(body: string): number | null {
  const match = /esperar\s+(\d+)\s+segundo/i.exec(body);
  return match ? Number(match[1]) : null;
}
