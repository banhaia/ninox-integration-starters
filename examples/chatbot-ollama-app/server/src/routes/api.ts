import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import {
  getKnowledgeBase,
  saveKnowledgeBase
} from "../services/knowledge-base-service.js";
import {
  listConversations,
  getConversation,
  createConversation,
  appendMessages,
  deleteConversation
} from "../services/conversation-service.js";
import { chatWithOllama, getOllamaConfig } from "../services/ollama-service.js";
import { buildStockContext } from "../services/stock-context-service.js";
import { stockSyncService } from "../services/stock-container.js";
import type { KnowledgeBase, OllamaMessage } from "../types/index.js";

export const apiRouter = Router();

// ── Simple in-memory rate limiter for the chat endpoint ───────────────────────
const CHAT_RATE_WINDOW_MS = 60_000; // 1 minute
const CHAT_RATE_MAX = 30; // max requests per window per IP
const chatRateMap = new Map<string, { count: number; resetAt: number }>();

function chatRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip ?? "unknown";
  const now = Date.now();
  const entry = chatRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    chatRateMap.set(ip, { count: 1, resetAt: now + CHAT_RATE_WINDOW_MS });
    next();
    return;
  }
  if (entry.count >= CHAT_RATE_MAX) {
    res.status(429).json({ error: "Demasiadas solicitudes. Intentá de nuevo en un minuto." });
    return;
  }
  entry.count++;
  next();
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Knowledge base ────────────────────────────────────────────────────────────

apiRouter.get("/knowledge-base", async (_req, res) => {
  try {
    const kb = await getKnowledgeBase();
    res.json(kb);
  } catch (error) {
    res.status(500).json({ error: "Error al leer la base de conocimiento" });
  }
});

apiRouter.post("/knowledge-base", async (req, res) => {
  const body = req.body as Partial<KnowledgeBase>;

  if (!body.nombreEmpresa || typeof body.nombreEmpresa !== "string") {
    res.status(400).json({ error: "nombreEmpresa es requerido" });
    return;
  }

  const kb: KnowledgeBase = {
    nombreEmpresa: body.nombreEmpresa,
    rubros: Array.isArray(body.rubros) ? body.rubros : [],
    descripcionProductos: typeof body.descripcionProductos === "string" ? body.descripcionProductos : "",
    quienesSomos: typeof body.quienesSomos === "string" ? body.quienesSomos : "",
    ubicaciones: Array.isArray(body.ubicaciones) ? body.ubicaciones : [],
    systemPrompt: typeof body.systemPrompt === "string" ? body.systemPrompt : ""
  };

  try {
    await saveKnowledgeBase(kb);
    res.json(kb);
  } catch (error) {
    res.status(500).json({ error: "Error al guardar la base de conocimiento" });
  }
});

// ── Chat ──────────────────────────────────────────────────────────────────────

apiRouter.post("/chat", chatRateLimiter, async (req, res) => {
  const { message, conversationId } = req.body as {
    message?: string;
    conversationId?: string;
  };

  if (!message || typeof message !== "string" || message.trim() === "") {
    res.status(400).json({ error: "El campo message es requerido" });
    return;
  }

  try {
    const kb = await getKnowledgeBase();

    // Build or load conversation
    let conv = conversationId ? await getConversation(conversationId) : null;
    if (!conv) {
      conv = await createConversation(message.trim());
    }

    const stockContext = await getStockContextForMessage(message.trim());

    // Build system message from knowledge base and stock cache
    const systemContent = buildSystemPrompt(kb, stockContext);

    // Build Ollama messages: system + history + new user message
    const ollamaMessages: OllamaMessage[] = [
      { role: "system", content: systemContent },
      ...conv.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content
      })),
      { role: "user", content: message.trim() }
    ];

    const reply = await chatWithOllama(ollamaMessages);

    const now = new Date().toISOString();
    const updatedConv = await appendMessages(conv.id, [
      { role: "user", content: message.trim(), timestamp: now },
      { role: "assistant", content: reply, timestamp: new Date().toISOString() }
    ]);

    res.json({
      reply,
      conversationId: updatedConv.id,
      conversation: updatedConv
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    console.error("[chat] Error:", msg);
    res.status(502).json({ error: `Error al comunicarse con Ollama: ${msg}` });
  }
});

// ── Conversations ─────────────────────────────────────────────────────────────

apiRouter.get("/conversations", async (_req, res) => {
  try {
    const list = await listConversations();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: "Error al listar conversaciones" });
  }
});

apiRouter.get("/conversations/:id", async (req, res) => {
  const { id } = req.params;
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    res.status(400).json({ error: "ID de conversación inválido" });
    return;
  }
  const conv = await getConversation(id);
  if (!conv) {
    res.status(404).json({ error: "Conversación no encontrada" });
    return;
  }
  res.json(conv);
});

apiRouter.delete("/conversations/:id", async (req, res) => {
  const { id } = req.params;
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    res.status(400).json({ error: "ID de conversación inválido" });
    return;
  }
  const deleted = await deleteConversation(id);
  if (!deleted) {
    res.status(404).json({ error: "Conversación no encontrada" });
    return;
  }
  res.json({ ok: true });
});

// ── Status ────────────────────────────────────────────────────────────────────

apiRouter.get("/status", async (_req, res) => {
  try {
    res.json({ ok: true, ollama: getOllamaConfig(), stock: await stockSyncService.getStatus() });
  } catch (error) {
    res.json({ ok: true, ollama: getOllamaConfig() });
  }
});

// ── Stock ─────────────────────────────────────────────────────────────────────

apiRouter.get("/stock/status", async (_req, res) => {
  try {
    res.json(await stockSyncService.getStatus());
  } catch (error) {
    res.status(500).json({ error: "Error al leer el estado de stock" });
  }
});

apiRouter.post("/stock/sync", async (_req, res) => {
  try {
    const result = await stockSyncService.syncNow();
    res.status(result.started ? 202 : 409).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    res.status(500).json({ error: `Error al sincronizar stock: ${message}` });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getStockContextForMessage(message: string): Promise<string> {
  try {
    const products = await stockSyncService.getProducts();
    return buildStockContext(products, message);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    console.error(`[stock-context] Error al construir contexto de stock: ${msg}`);
    return [
      "--- STOCK DISPONIBLE ---",
      "No se pudo leer el stock local. No inventes disponibilidad, precios, talles ni colores."
    ].join("\n");
  }
}

function buildSystemPrompt(kb: KnowledgeBase, stockContext: string): string {
  const parts: string[] = [kb.systemPrompt];

  parts.push(`\n\n--- INFORMACIÓN DE LA EMPRESA ---`);
  parts.push(`Empresa: ${kb.nombreEmpresa}`);

  if (kb.rubros.length > 0) {
    parts.push(`Rubros: ${kb.rubros.join(", ")}`);
  }

  if (kb.quienesSomos) {
    parts.push(`\nQuiénes somos:\n${kb.quienesSomos}`);
  }

  if (kb.descripcionProductos) {
    parts.push(`\nProductos y servicios:\n${kb.descripcionProductos}`);
  }

  if (kb.ubicaciones.length > 0) {
    parts.push(`\nUbicaciones:\n${kb.ubicaciones.map((u) => `- ${u}`).join("\n")}`);
  }

  parts.push(`\n${stockContext}`);

  return parts.join("\n");
}
