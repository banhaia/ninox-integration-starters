import { loadEnv } from "../config/env";
import type { CreateOrderInput } from "../types/product";

export interface NinoxClientOptions {
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class NinoxApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "NinoxApiError";
    this.status = status;
    this.body = body;
  }
}

export class NinoxClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: NinoxClientOptions = {}) {
    const env = loadEnv();
    this.baseUrl = options.baseUrl ?? env.baseUrl;
    this.token = options.token ?? env.token;
    this.timeoutMs = options.timeoutMs ?? env.timeoutMs;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getProducts(): Promise<unknown[]> {
    const response = await this.request("/integraciones/Terceros/GetData", {
      method: "GET"
    });

    if (Array.isArray(response)) {
      return response;
    }

    if (Array.isArray((response as { data?: unknown[] })?.data)) {
      return (response as { data: unknown[] }).data;
    }

    throw new Error("Unexpected Ninox response format for GetData");
  }

  async createOrder(input: CreateOrderInput): Promise<never> {
    void input;

    throw new Error(
      "createOrder() is a placeholder. Confirm the Ninox order endpoint and payload contract before enabling it."
    );
  }

  async getMediosPago(): Promise<unknown> {
    return this.request("/integraciones/terceros/medios-pago", { method: "GET" });
  }

  async createPedido(payload: unknown): Promise<unknown> {
    return this.request("/integraciones/Terceros/Pedido", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const start = Date.now();

    console.log(`[ninox] → ${init.method ?? "GET"} ${url}`);
    if (init.body) {
      console.log(`[ninox]   body: ${String(init.body).slice(0, 500)}`);
    }

    try {
      const response = await this.fetchImpl(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "X-NX-TOKEN": this.token,
          ...init.headers
        },
        signal: controller.signal
      });

      const rawBody = await response.text();
      console.log(`[ninox] ← ${response.status} ${url} (${Date.now() - start}ms)`);

      if (!response.ok) {
        console.log(`[ninox]   error body: ${rawBody.slice(0, 500)}`);
        const message = rawBody?.trim()
          ? `Ninox request failed with status ${response.status}: ${rawBody.trim()}`
          : `Ninox request failed with status ${response.status}`;

        throw new NinoxApiError(
          message,
          response.status,
          rawBody
        );
      }

      if (!rawBody) {
        return null;
      }

      try {
        return JSON.parse(rawBody);
      } catch {
        return rawBody;
      }
    } catch (error) {
      if (error instanceof NinoxApiError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        console.log(`[ninox]   timeout after ${this.timeoutMs}ms: ${url}`);
        throw new Error(`Ninox request timed out after ${this.timeoutMs}ms`);
      }

      throw new Error(
        `Ninox request failed: ${error instanceof Error ? error.message : "unknown error"}`,
        { cause: error }
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
