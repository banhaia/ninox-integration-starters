import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { openDatabase } from "../server/src/db/connection.js";
import { createContext, type AppContext } from "../server/src/context.js";
import { createApp } from "../server/src/app.js";
import { CatalogSyncService } from "../server/src/modules/catalog/sync-service.js";
import { IngestRunner } from "../server/src/modules/ingest/runner.js";

/** Fixtures ficticias con la forma real del contrato (shared/sample-responses). */
export function fixture<T>(name: string): T {
  const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "shared", "sample-responses", name);
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export interface FakeCall {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  headers: Record<string, string>;
}

export type FakeHandler = (call: FakeCall) => { status?: number; body?: unknown } | Error;

/**
 * Contexto de test: SQLite en memoria, fetch simulado de Ninox y reloj falso para el
 * rate limiter (las esperas avanzan el reloj en lugar de dormir).
 */
export function createTestContext(routes: Record<string, FakeHandler> = {}) {
  const db = openDatabase(":memory:");
  const calls: FakeCall[] = [];
  let clock = Date.UTC(2026, 2, 1);

  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const call: FakeCall = {
      method,
      path: url.pathname,
      query: url.searchParams,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      headers: (init?.headers ?? {}) as Record<string, string>
    };
    calls.push(call);

    const handler = routes[`${method} ${url.pathname}`];
    if (!handler) return new Response("not found", { status: 404 });
    const result = handler(call);
    if (result instanceof Error) throw result;
    const body = typeof result.body === "string" ? result.body : JSON.stringify(result.body ?? null);
    return new Response(body, { status: result.status ?? 200 });
  }) as typeof fetch;

  const ctx: AppContext = createContext(db, {
    fetchImpl,
    secureCookies: false,
    limiter: {
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      }
    }
  });

  return {
    db,
    ctx,
    calls,
    advance: (ms: number) => {
      clock += ms;
    },
    /** Configura el token y crea el usuario 1 (dueño de pedidos y jobs en los tests). */
    connect: () => {
      ctx.settings.saveNinox({ env: "test", token: "token-de-prueba" });
      db.prepare("INSERT OR IGNORE INTO users (id, username, password_hash, created_at) VALUES (1, 'test', 'x', ?)").run(
        new Date().toISOString()
      );
    }
  };
}

/** Levanta la app Express en un puerto efímero y devuelve un fetch con cookie de sesión. */
export async function startApp(ctx: AppContext) {
  const catalogSync = new CatalogSyncService(ctx, 15);
  const ingest = new IngestRunner(ctx);
  const app = createApp(ctx, { catalogSync, ingest });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let cookie = "";

  async function api(pathname: string, init: { method?: string; json?: unknown } = {}) {
    const response = await fetch(`${base}${pathname}`, {
      method: init.method ?? "GET",
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: init.json === undefined ? undefined : JSON.stringify(init.json)
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const text = await response.text();
    return { status: response.status, body: text ? (JSON.parse(text) as Record<string, unknown>) : null };
  }

  return {
    api,
    ingest,
    catalogSync,
    clearCookie: () => {
      cookie = "";
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}
