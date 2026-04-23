import type { ProductsPayload } from "@ninox/stock-ui";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KnowledgeBase {
  nombreEmpresa: string;
  rubros: string[];
  descripcionProductos: string;
  quienesSomos: string;
  ubicaciones: string[];
  systemPrompt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage: string;
}

export interface ChatResponse {
  reply: string;
  conversationId: string;
  conversation: Conversation;
}

export interface StatusResponse {
  ok: boolean;
  ollama: { baseUrl: string; model: string };
  stock?: StockStatusResponse;
}

export interface StockStatusResponse {
  syncInProgress: boolean;
  lastSyncAt: string | null;
  lastSyncSource: string | null;
  syncError: string | null;
  configuredSourceIds: string[];
  hasConfiguredSources: boolean;
  productCount: number;
}

export interface StockSyncResponse {
  started: boolean;
  message: string;
}

// ── Request helper ────────────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ── API functions ─────────────────────────────────────────────────────────────

export function getKnowledgeBase(): Promise<KnowledgeBase> {
  return request("/api/knowledge-base");
}

export function saveKnowledgeBase(kb: KnowledgeBase): Promise<KnowledgeBase> {
  return request("/api/knowledge-base", {
    method: "POST",
    body: JSON.stringify(kb)
  });
}

export function sendChatMessage(
  message: string,
  conversationId?: string
): Promise<ChatResponse> {
  return request("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message, conversationId })
  });
}

export function listConversations(): Promise<ConversationSummary[]> {
  return request("/api/conversations");
}

export function getConversation(id: string): Promise<Conversation> {
  return request(`/api/conversations/${id}`);
}

export function deleteConversation(id: string): Promise<{ ok: boolean }> {
  return request(`/api/conversations/${id}`, { method: "DELETE" });
}

export function getStatus(): Promise<StatusResponse> {
  return request("/api/status");
}

export function getStockStatus(): Promise<StockStatusResponse> {
  return request("/api/stock/status");
}

export function syncStock(): Promise<StockSyncResponse> {
  return request("/api/stock/sync", { method: "POST" });
}

export function getStockProducts(params: URLSearchParams): Promise<ProductsPayload> {
  return request(`/api/stock/products?${params.toString()}`);
}
