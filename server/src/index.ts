import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { openDatabase } from "./db/connection.js";
import { createContext } from "./context.js";
import { createApp } from "./app.js";
import { purgeExpiredSessions } from "./auth/session.js";
import { CatalogSyncService } from "./modules/catalog/sync-service.js";
import { IngestRunner } from "./modules/ingest/runner.js";
import { trustSystemCertificates } from "./lib/tls.js";

trustSystemCertificates();

if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
  console.warn("[security] NODE_TLS_REJECT_UNAUTHORIZED=0: verificación TLS desactivada (solo desarrollo local).");
}

const dbFile = path.join(config.dataDir, "ninox-app.db");
const db = openDatabase(dbFile);
const ctx = createContext(db);

// Pedidos que quedaron "pending" por un corte del proceso: su resultado en Ninox es desconocido.
db.prepare(
  "UPDATE orders SET status = 'unknown', error = 'El servidor se reinició durante el envío. Verificá en Ninox antes de reintentar.' WHERE status = 'pending'"
).run();
purgeExpiredSessions(db);

const catalogSync = new CatalogSyncService(ctx, config.catalogSyncMinutes);
const ingest = new IngestRunner(ctx);

const clientDistPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "client");
const app = createApp(ctx, { catalogSync, ingest }, { clientDistPath });

const server = app.listen(config.port, () => {
  console.log(`[server] http://localhost:${config.port} · base ${dbFile}`);
  if (!ctx.hasNinoxConnection()) {
    console.log("[server] Sin token de Ninox: configuralo desde la app (Configuración).");
  }
  catalogSync.start();
  ingest.start();
});

function shutdown(): void {
  catalogSync.stop();
  ingest.stop();
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
