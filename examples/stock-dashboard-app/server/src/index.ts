import fs from "node:fs";
import path from "node:path";
import express from "express";
import { fileURLToPath } from "node:url";
import { apiRouter } from "./routes/api.js";
import { catalogSyncService } from "./services/container.js";

if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
  console.warn("[security] NODE_TLS_REJECT_UNAUTHORIZED=0 — TLS verification disabled (solo desarrollo local).");
}

const port = Number(process.env.PORT ?? 3030);
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, "..", "client");

app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[http] ${req.method} ${req.path} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

app.use("/api", apiRouter);
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.get("*", (request, response, next) => {
    if (request.path.startsWith("/api")) {
      next();
      return;
    }

    response.sendFile(path.join(clientDistPath, "index.html"));
  });
}

catalogSyncService
  .init()
  .catch((error) => {
    console.error("Failed to initialize catalog sync service", error);
  });

app.listen(port, () => {
  console.log(`Stock dashboard server running at http://localhost:${port}`);
});
