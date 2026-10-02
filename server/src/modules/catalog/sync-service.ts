import type { AppContext } from "../../context.js";
import { RateLimitedError } from "../../ninox/rate-limiter.js";
import { mapCatalog } from "./mapper.js";
import { replaceCatalog } from "./repository.js";

export interface CatalogSyncStatus {
  configured: boolean;
  syncInProgress: boolean;
  lastSyncAt: string | null;
  lastRunStatus: string | null;
  lastError: string | null;
  nextAllowedInSeconds: number;
  intervalMinutes: number;
}

/**
 * Sincroniza el catálogo con GetData (foto completa) y lo guarda en SQLite.
 * Respeta la ventana del bucket "masivo" (10 min prod / 3 min test), persistida en la base.
 */
export class CatalogSyncService {
  private inProgress = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly ctx: AppContext,
    private readonly intervalMinutes: number
  ) {}

  start(): void {
    const tick = (): void => {
      if (!this.ctx.hasNinoxConnection() || this.inProgress) return;
      if (this.ctx.limiter.remainingMs("masivo") > 0 && this.hasData()) return;
      if (!this.isDue()) return;
      void this.sync("scheduler").catch(() => undefined);
    };

    // Primer intento a los pocos segundos de arrancar, después cada minuto se evalúa si toca.
    setTimeout(tick, 5000);
    this.timer = setInterval(tick, 60_000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  status(): CatalogSyncStatus {
    const last = this.ctx.db
      .prepare("SELECT status, error, finished_at FROM catalog_sync_runs ORDER BY id DESC LIMIT 1")
      .get() as { status: string; error: string | null; finished_at: string | null } | undefined;
    const lastOk = this.ctx.db
      .prepare("SELECT finished_at FROM catalog_sync_runs WHERE status = 'ok' ORDER BY id DESC LIMIT 1")
      .get() as { finished_at: string } | undefined;

    return {
      configured: this.ctx.hasNinoxConnection(),
      syncInProgress: this.inProgress,
      lastSyncAt: lastOk?.finished_at ?? null,
      lastRunStatus: last?.status ?? null,
      lastError: last?.status === "error" ? last.error : null,
      nextAllowedInSeconds: Math.ceil(this.ctx.limiter.remainingMs("masivo") / 1000),
      intervalMinutes: this.intervalMinutes
    };
  }

  /** Lanza un sync. Si la ventana de Ninox no está libre falla con RateLimitedError (429 local). */
  async sync(trigger: "manual" | "scheduler"): Promise<{ articulos: number }> {
    if (this.inProgress) throw new Error("Ya hay una sincronización en curso");

    const client = this.ctx.ninox();
    this.inProgress = true;
    const startedAt = new Date().toISOString();
    const run = this.ctx.db
      .prepare("INSERT INTO catalog_sync_runs (trigger, status, started_at) VALUES (?, 'running', ?)")
      .run(trigger, startedAt);
    const runId = Number(run.lastInsertRowid);

    try {
      const raw = await client.getData();
      const snapshot = mapCatalog(raw);
      const finishedAt = new Date().toISOString();
      replaceCatalog(this.ctx.db, snapshot, finishedAt);
      this.ctx.db
        .prepare("UPDATE catalog_sync_runs SET status = 'ok', articulos = ?, finished_at = ? WHERE id = ?")
        .run(snapshot.articulos.length, finishedAt, runId);
      console.log(`[catalog] sync ${trigger}: ${snapshot.articulos.length} artículos`);
      return { articulos: snapshot.articulos.length };
    } catch (error) {
      const skipped = error instanceof RateLimitedError;
      this.ctx.db
        .prepare("UPDATE catalog_sync_runs SET status = ?, error = ?, finished_at = ? WHERE id = ?")
        .run(skipped ? "skipped" : "error", error instanceof Error ? error.message : String(error), new Date().toISOString(), runId);
      if (!skipped) console.warn(`[catalog] sync ${trigger} falló: ${error instanceof Error ? error.message : error}`);
      throw error;
    } finally {
      this.inProgress = false;
    }
  }

  private hasData(): boolean {
    return Boolean(this.ctx.db.prepare("SELECT 1 FROM articulos WHERE eliminado = 0 LIMIT 1").get());
  }

  private isDue(): boolean {
    const last = this.status().lastSyncAt;
    if (!last) return true;
    return Date.now() - new Date(last).getTime() >= this.intervalMinutes * 60_000;
  }
}
