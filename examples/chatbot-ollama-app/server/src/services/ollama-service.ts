import type { OllamaChatRequest, OllamaChatResponse, OllamaMessage } from "../types/index.js";

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";

export async function chatWithOllama(messages: OllamaMessage[]): Promise<string> {
  const body: OllamaChatRequest = {
    model: OLLAMA_MODEL,
    messages,
    stream: false
  };

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Ollama error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as OllamaChatResponse;
  return data.message.content;
}

export function getOllamaConfig(): { baseUrl: string; model: string } {
  return { baseUrl: OLLAMA_BASE_URL, model: OLLAMA_MODEL };
}
