import { parseWaitSeconds, RateLimitedError, type RateBucket, type RateLimiter } from "./rate-limiter.js";
import type {
  ExportKind,
  ExportParams,
  NinoxArticulo,
  NinoxComprobante,
  NinoxConfig,
  NinoxFacturaResult,
  NinoxPaginado,
  NinoxPedido,
  NinoxResultado,
  NinoxSaldosPaginado,
  NinoxStockPage,
  NinoxVenta
} from "./types.js";

export interface NinoxClientOptions {
  baseUrl: string;
  token: string;
  timeoutMs: number;
  limiter: RateLimiter;
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

/**
 * No hubo respuesta HTTP de Ninox.
 * - `sent = false`: la request nunca llegó (conexión rechazada, DNS, certificado TLS):
 *   es seguro reintentar un POST.
 * - `sent = true`: timeout o corte a mitad de camino: el resultado en Ninox es desconocido.
 */
export class NinoxNetworkError extends Error {
  readonly sent: boolean;
  readonly timedOut: boolean;

  constructor(message: string, options: { sent: boolean; timedOut?: boolean; cause?: unknown }) {
    super(message, { cause: options.cause });
    this.name = "NinoxNetworkError";
    this.sent = options.sent;
    this.timedOut = options.timedOut ?? false;
  }
}

const NOT_SENT_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH"]);

/** Traduce el error de fetch a un mensaje accionable. */
function describeNetworkError(error: unknown, baseUrl: string, timeoutMs: number): NinoxNetworkError {
  if (error instanceof Error && error.name === "AbortError") {
    return new NinoxNetworkError(`Ninox no respondió en ${Math.round(timeoutMs / 1000)} s (${baseUrl})`, {
      sent: true,
      timedOut: true,
      cause: error
    });
  }

  const cause = (error as { cause?: { code?: string; message?: string } } | undefined)?.cause;
  const code = cause?.code ?? "";

  if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS/i.test(code)) {
    return new NinoxNetworkError(
      `El certificado HTTPS de ${baseUrl} no es de confianza (${code}). Si es una API local, confiá el certificado de desarrollo en el sistema (por ejemplo \`dotnet dev-certs https --trust\`) y reiniciá el servidor; la app usa los certificados del sistema.`,
      { sent: false, cause: error }
    );
  }
  if (NOT_SENT_CODES.has(code)) {
    return new NinoxNetworkError(`No se pudo conectar con ${baseUrl} (${code}). Verificá la URL y que la API esté levantada.`, {
      sent: false,
      cause: error
    });
  }
  return new NinoxNetworkError(`Se cortó la conexión con Ninox (${code || cause?.message || "error de red"})`, {
    sent: true,
    cause: error
  });
}

interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  bucket?: RateBucket;
  /** true: espera a que se libere el bucket (procesos en segundo plano). false: falla con RateLimitedError. */
  wait?: boolean;
  /** Reintentos ante 5xx o errores de red. Solo para GET. */
  retries?: number;
  signal?: AbortSignal;
}

export interface CallOptions {
  wait?: boolean;
  signal?: AbortSignal;
}

const EXPORT_PATHS: Record<ExportKind, string> = {
  ventaitems: "/integraciones/terceros/exportar/ventaitems/paginado",
  ventatotales: "/integraciones/terceros/exportar/ventatotales/paginado",
  compraitems: "/integraciones/terceros/exportar/compraitems/paginado",
  compratotales: "/integraciones/terceros/exportar/compratotales/paginado"
};

/**
 * Cliente HTTP de la integración de terceros. Solo corre en el backend: el token
 * nunca llega al navegador. No loguea bodies ni el token (pueden tener datos personales).
 */
export class NinoxClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: NinoxClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  // ── Parámetros ───────────────────────────────────────────────────────────

  getConfig(call: CallOptions = {}): Promise<NinoxConfig> {
    return this.request("GET", "/integraciones/terceros/config", { bucket: "parametros", ...call });
  }

  getMediosPago(call: CallOptions = {}): Promise<unknown> {
    return this.request("GET", "/integraciones/terceros/medios-pago", { bucket: "parametros", ...call });
  }

  // ── Catálogo ─────────────────────────────────────────────────────────────

  async getData(depositoId?: number, call: CallOptions = {}): Promise<NinoxArticulo[]> {
    const response = await this.request<unknown>("GET", "/integraciones/Terceros/GetData", {
      bucket: "masivo",
      query: { depositoId },
      ...call
    });
    if (Array.isArray(response)) return response as NinoxArticulo[];
    const data = (response as { data?: unknown } | null)?.data;
    if (Array.isArray(data)) return data as NinoxArticulo[];
    throw new Error("Respuesta inesperada de GetData");
  }

  // ── Comprobantes (sin reintentos automáticos: podrían duplicar) ─────────

  createPedido(payload: NinoxPedido): Promise<NinoxFacturaResult> {
    return this.request("POST", "/integraciones/Terceros/Pedido", { body: payload });
  }

  createVenta(payload: NinoxVenta): Promise<NinoxFacturaResult> {
    return this.request("POST", "/integraciones/terceros/venta", { body: payload });
  }

  cancelarPedido(facturaId: number): Promise<NinoxResultado> {
    return this.request("POST", "/integraciones/Terceros/Pedido/cancelar", { query: { facturaid: facturaId } });
  }

  getComprobante(facturaId: number, call: CallOptions = {}): Promise<NinoxComprobante> {
    return this.request("GET", `/integraciones/terceros/comprobante/${facturaId}`, { bucket: "comprobante", ...call });
  }

  // ── Exportaciones ────────────────────────────────────────────────────────

  exportPaged<T>(kind: ExportKind, params: ExportParams, call: CallOptions = {}): Promise<NinoxPaginado<T>> {
    return this.request("GET", EXPORT_PATHS[kind], {
      bucket: "comprobantePaginado",
      retries: 2,
      query: {
        sucursalId: params.sucursalId,
        anio: params.anio,
        mes: String(params.mes).padStart(2, "0"),
        page: params.page,
        pageSize: params.pageSize,
        incluirMediosPago: params.incluirMediosPago ? true : undefined
      },
      ...call
    });
  }

  /** Preparado: snapshot de stock por depósito (bucket masivo, compartido con GetData). */
  exportStock(depositoId: number, call: CallOptions = {}): Promise<NinoxStockPage> {
    return this.request("GET", "/integraciones/terceros/exportar/stock", {
      bucket: "masivo",
      query: { depositoId },
      ...call
    });
  }

  /** Preparado: saldos vencidos paginados (bucket corto de saldos, pageSize máx. 100). */
  saldosPaginado(
    tipo: "clientes" | "proveedores",
    params: { sucursalId?: number; page: number; pageSize: number },
    call: CallOptions = {}
  ): Promise<NinoxSaldosPaginado> {
    return this.request("GET", `/integraciones/terceros/saldos/${tipo}/paginado`, {
      bucket: "saldos",
      retries: 2,
      query: params,
      ...call
    });
  }

  // ── Transporte ───────────────────────────────────────────────────────────

  private async request<T>(method: "GET" | "POST", path: string, options: RequestOptions = {}): Promise<T> {
    const retries = method === "GET" ? (options.retries ?? 0) : 0;

    for (let attempt = 0; ; attempt++) {
      if (options.bucket) {
        if (options.wait) await this.options.limiter.acquire(options.bucket, options.signal);
        else this.options.limiter.take(options.bucket);
      }

      try {
        return await this.send<T>(method, path, options);
      } catch (error) {
        const retriable =
          error instanceof NinoxNetworkError || (error instanceof NinoxApiError && error.status >= 500);
        if (!retriable || attempt >= retries) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * 3 ** attempt));
      }
    }
  }

  private async send<T>(method: string, path: string, options: RequestOptions): Promise<T> {
    const url = new URL(path, this.options.baseUrl);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    const onAbort = (): void => controller.abort();
    options.signal?.addEventListener("abort", onAbort, { once: true });
    const started = Date.now();

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-NX-TOKEN": this.options.token
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal
      });
    } catch (error) {
      const networkError = describeNetworkError(error, this.options.baseUrl, this.options.timeoutMs);
      console.warn(`[ninox] ${method} ${path} → ${networkError.message} (${Date.now() - started}ms)`);
      throw networkError;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", onAbort);
    }

    const text = await response.text();
    console.log(`[ninox] ${method} ${path} → ${response.status} (${Date.now() - started}ms)`);

    if (!response.ok) {
      const detail = text.trim().slice(0, 300);
      if (response.status === 403 && options.bucket) {
        const wait = parseWaitSeconds(text);
        if (wait !== null) {
          this.options.limiter.penalize(options.bucket, wait);
          throw new RateLimitedError(options.bucket, wait);
        }
      }
      throw new NinoxApiError(describeStatus(response.status, detail), response.status, detail);
    }

    if (!text) return null as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }
}

function describeStatus(status: number, detail: string): string {
  const base: Record<number, string> = {
    400: "Ninox rechazó la solicitud (400)",
    401: "Token de Ninox inválido o expirado (401)",
    403: "Ninox denegó la solicitud (403)",
    404: "Ninox no encontró el recurso (404)",
    422: "Ninox rechazó los datos (422)"
  };
  const prefix = base[status] ?? `Ninox respondió ${status}`;
  return detail ? `${prefix}: ${detail}` : prefix;
}
