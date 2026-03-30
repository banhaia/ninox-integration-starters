import fs from "node:fs";
import path from "node:path";
import express from "express";
import { fileURLToPath } from "node:url";
import { apiRouter } from "./routes/api.js";
import { catalogSyncService } from "./services/container.js";

const port = Number(process.env.PORT ?? 3030);
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, "..", "client");

app.use(express.json());
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
