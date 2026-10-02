import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Conversation, ConversationSummary, ChatMessage } from "../types/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONVERSATIONS_DIR = path.resolve(__dirname, "..", "..", "..", "data", "conversations");

function generateId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeId(id: string): string | null {
  // Allow only alphanumeric, underscore and hyphen characters to prevent path traversal
  if (/^[a-zA-Z0-9_-]+$/.test(id)) return id;
  return null;
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(CONVERSATIONS_DIR, { recursive: true });
}

function convPath(id: string): string {
  return path.join(CONVERSATIONS_DIR, `${id}.json`);
}

export async function listConversations(): Promise<ConversationSummary[]> {
  await ensureDir();
  let files: string[];
  try {
    files = await fs.readdir(CONVERSATIONS_DIR);
  } catch {
    return [];
  }

  const summaries: ConversationSummary[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(CONVERSATIONS_DIR, file), "utf-8");
      const conv = JSON.parse(raw) as Conversation;
      const lastMsg = conv.messages.at(-1);
      summaries.push({
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messageCount: conv.messages.length,
        lastMessage: lastMsg ? lastMsg.content.slice(0, 100) : ""
      });
    } catch {
      // skip malformed files
    }
  }

  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const safeId = sanitizeId(id);
  if (!safeId) return null;
  try {
    const raw = await fs.readFile(convPath(safeId), "utf-8");
    return JSON.parse(raw) as Conversation;
  } catch {
    return null;
  }
}

export async function createConversation(firstUserMessage: string): Promise<Conversation> {
  await ensureDir();
  const id = generateId();
  const now = new Date().toISOString();
  const title = firstUserMessage.slice(0, 60) + (firstUserMessage.length > 60 ? "..." : "");
  const conv: Conversation = {
    id,
    title,
    createdAt: now,
    updatedAt: now,
    messages: []
  };
  await fs.writeFile(convPath(id), JSON.stringify(conv, null, 2), "utf-8");
  return conv;
}

export async function appendMessages(
  id: string,
  messages: ChatMessage[]
): Promise<Conversation> {
  const safeId = sanitizeId(id);
  if (!safeId) throw new Error(`Invalid conversation id: ${id}`);
  const conv = await getConversation(safeId);
  if (!conv) throw new Error(`Conversation ${safeId} not found`);
  conv.messages.push(...messages);
  conv.updatedAt = new Date().toISOString();
  await fs.writeFile(convPath(safeId), JSON.stringify(conv, null, 2), "utf-8");
  return conv;
}

export async function deleteConversation(id: string): Promise<boolean> {
  const safeId = sanitizeId(id);
  if (!safeId) return false;
  try {
    await fs.unlink(convPath(safeId));
    return true;
  } catch {
    return false;
  }
}

export function conversationsExist(): boolean {
  try {
    return fsSync.existsSync(CONVERSATIONS_DIR);
  } catch {
    return false;
  }
}
