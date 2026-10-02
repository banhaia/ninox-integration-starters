import type { AppContext } from "../../context.js";
import { HttpError } from "../../lib/http.js";
import { RateLimitedError } from "../../ninox/rate-limiter.js";
import { handlers, type IngestJob, type IngestJobParams, type IngestType } from "./handlers.js";

export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export interface JobView {
  id: number;
  type: IngestType;
  label: string;
  sucursalId: number | null;
  periodo: string | null;
  params: IngestJobParams;
  status: JobStatus;
  page: number;
  totalPages: number | null;
  rows: number;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

interface JobRow {
  id: number;
  type: IngestType;
  sucursal_id: number | null;
  periodo: string | null;
  params_json: string;
  status: JobStatus;
  page: number;
  total_pages: number | null;
  rows: number;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

const MAX_RATE_LIMIT_RETRIES = 5;
const IDLE_POLL_MS = 2000;

function toView(row: JobRow): JobView {
  return {
    id: row.id,
    type: row.type,
    label: handlers[row.type]?.label ?? row.type,
    sucursalId: row.sucursal_id,
    periodo: row.periodo,
    params: JSON.parse(row.params_json) as IngestJobParams,
    status: row.status,
    page: row.page,
    totalPages: row.total_pages,
    rows: row.rows,
    error: row.error,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at
  };
}

/**
 * Worker de ingesta en el mismo proceso. Procesa los jobs de a uno, página por página,
 * esperando la ventana de rate limit de Ninox antes de cada request.
 *
 * - Cada página descargada se guarda en ingest_staging junto con el progreso, así un
 *   reinicio retoma desde la última página completa.
 * - Al terminar, el handler reemplaza el alcance del job (sucursal + período) en una
 *   transacción: reimportar un mes nunca duplica filas.
 */
export class IngestRunner {
  private running = false;
  private stopped = false;
  private current: { jobId: number; controller: AbortController } | null = null;
  private wakeUp: (() => void) | null = null;

  constructor(private readonly ctx: AppContext) {}

  start(): void {
    // Jobs que quedaron "running" por un reinicio vuelven a la cola y retoman.
    this.ctx.db.prepare("UPDATE ingest_jobs SET status = 'queued' WHERE status = 'running'").run();
    void this.loop();
  }

  stop(): void {
    this.stopped = true;
    this.current?.controller.abort();
    this.wakeUp?.();
  }

  enqueue(type: IngestType, params: IngestJobParams, userId: number): JobView {
    const handler = handlers[type];
    if (!handler?.enabled) throw new HttpError(400, `Tipo de ingesta no disponible: ${type}`);

    const now = new Date().toISOString();
    const result = this.ctx.db
      .prepare(
        `INSERT INTO ingest_jobs (type, sucursal_id, periodo, params_json, status, created_by, created_at)
         VALUES (?, ?, ?, ?, 'queued', ?, ?)`
      )
      .run(type, params.sucursalId ?? null, params.periodo ?? null, JSON.stringify(params), userId, now);
    this.wakeUp?.();
    return this.get(Number(result.lastInsertRowid));
  }

  get(id: number): JobView {
    const row = this.ctx.db.prepare("SELECT * FROM ingest_jobs WHERE id = ?").get(id) as JobRow | undefined;
    if (!row) throw new HttpError(404, "Job no encontrado");
    return toView(row);
  }

  list(limit = 100): JobView[] {
    return (
      this.ctx.db.prepare("SELECT * FROM ingest_jobs ORDER BY id DESC LIMIT ?").all(Math.min(limit, 500)) as JobRow[]
    ).map(toView);
  }

  cancel(id: number): JobView {
    const job = this.get(id);
    if (job.status === "running" && this.current?.jobId === id) {
      this.current.controller.abort();
    } else if (job.status === "queued") {
      this.finish(id, "cancelled", null);
    } else {
      throw new HttpError(409, `El job está ${job.status}`);
    }
    return this.get(id);
  }

  retry(id: number): JobView {
    const job = this.get(id);
    if (job.status !== "failed" && job.status !== "cancelled") {
      throw new HttpError(409, "Solo se reintentan jobs fallidos o cancelados");
    }
    this.ctx.db.prepare("UPDATE ingest_jobs SET status = 'queued', error = NULL, finished_at = NULL WHERE id = ?").run(id);
    this.wakeUp?.();
    return this.get(id);
  }

  /** Procesa la cola hasta vaciarla. Expuesto para tests. */
  async drain(): Promise<void> {
    for (;;) {
      const next = this.ctx.db
        .prepare("SELECT * FROM ingest_jobs WHERE status = 'queued' ORDER BY id LIMIT 1")
        .get() as JobRow | undefined;
      if (!next || this.stopped) return;
      await this.runJob(toView(next));
    }
  }

  private async loop(): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (!this.stopped) {
      try {
        if (this.ctx.hasNinoxConnection()) await this.drain();
      } catch (error) {
        console.error("[ingest] error en el loop:", error instanceof Error ? error.message : error);
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, IDLE_POLL_MS);
        this.wakeUp = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      this.wakeUp = null;
    }
    this.running = false;
  }

  private async runJob(view: JobView): Promise<void> {
    const handler = handlers[view.type];
    const job: IngestJob = { id: view.id, type: view.type, params: view.params };
    const controller = new AbortController();
    this.current = { jobId: view.id, controller };

    this.ctx.db
      .prepare("UPDATE ingest_jobs SET status = 'running', started_at = COALESCE(started_at, ?) WHERE id = ?")
      .run(new Date().toISOString(), view.id);

    const insertStaging = this.ctx.db.prepare("INSERT INTO ingest_staging (job_id, page, row_json) VALUES (?, ?, ?)");
    const saveProgress = this.ctx.db.prepare(
      "UPDATE ingest_jobs SET page = ?, total_pages = ?, rows = rows + ? WHERE id = ?"
    );

    try {
      const client = this.ctx.ninox();
      let page = view.page;
      let totalPages = view.totalPages ?? Number.POSITIVE_INFINITY;
      let rateLimitRetries = 0;

      while (page < totalPages) {
        const nextPage = page + 1;
        let result;
        try {
          result = await handler.fetchPage(client, job, nextPage, { wait: true, signal: controller.signal });
        } catch (error) {
          // Ninox respondió "Debe esperar N segundos": el limiter ya registró la espera.
          if (error instanceof RateLimitedError && rateLimitRetries < MAX_RATE_LIMIT_RETRIES) {
            rateLimitRetries += 1;
            continue;
          }
          throw error;
        }
        rateLimitRetries = 0;

        this.ctx.db.transaction(() => {
          this.ctx.db.prepare("DELETE FROM ingest_staging WHERE job_id = ? AND page = ?").run(view.id, nextPage);
          for (const item of result.items) insertStaging.run(view.id, nextPage, JSON.stringify(item));
          saveProgress.run(nextPage, result.totalPages, result.items.length, view.id);
        })();

        page = nextPage;
        totalPages = result.totalPages;
        if (result.items.length === 0) break;
      }

      const rows = (
        this.ctx.db
          .prepare("SELECT row_json FROM ingest_staging WHERE job_id = ? ORDER BY page, rowid")
          .all(view.id) as Array<{ row_json: string }>
      ).map((row) => JSON.parse(row.row_json) as unknown);

      const inserted = this.ctx.db.transaction(() => {
        const count = handler.commit(this.ctx.db, job, rows);
        this.ctx.db.prepare("DELETE FROM ingest_staging WHERE job_id = ?").run(view.id);
        this.ctx.db.prepare("UPDATE ingest_jobs SET rows = ? WHERE id = ?").run(count, view.id);
        return count;
      })();

      this.finish(view.id, "done", null);
      console.log(`[ingest] job ${view.id} ${view.type} ${view.periodo ?? ""}: ${inserted} filas`);
    } catch (error) {
      const cancelled = controller.signal.aborted;
      const message = error instanceof Error ? error.message : String(error);
      this.finish(view.id, cancelled ? "cancelled" : "failed", cancelled ? null : message);
      if (!cancelled) console.warn(`[ingest] job ${view.id} falló: ${message}`);
    } finally {
      this.current = null;
    }
  }

  private finish(id: number, status: JobStatus, error: string | null): void {
    this.ctx.db
      .prepare("UPDATE ingest_jobs SET status = ?, error = ?, finished_at = ? WHERE id = ?")
      .run(status, error, new Date().toISOString(), id);
  }
}
