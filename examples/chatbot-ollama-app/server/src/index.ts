import fs from "node:fs";
import path from "node:path";
import express from "express";
import { fileURLToPath } from "node:url";
import { apiRouter } from "./routes/api.js";

const port = Number(process.env.PORT ?? 3031);
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

app.listen(port, () => {
  console.log(`Chatbot Ollama server running at http://localhost:${port}`);
  console.log(`Ollama URL: ${process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"}`);
  console.log(`Ollama model: ${process.env.OLLAMA_MODEL ?? "llama3.2"}`);
});
