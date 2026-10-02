import type { ProductsPayload, StockRow } from "@/components/stock/types";

export type { ProductsPayload, StockRow };

// ── Transporte ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Evento global: la sesión expiró (el AuthProvider vuelve al login). */
export const UNAUTHORIZED_EVENT = "nx:unauthorized";

async function request<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const response = await fetch(path, {
    credentials: "same-origin",
    ...rest,
    headers: { "Content-Type": "application/json", ...(rest.headers ?? {}) },
    body: json === undefined ? rest.body : JSON.stringify(json)
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/api/auth/")) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    const body = data as { error?: string; details?: unknown } | undefined;
    throw new ApiError(body?.error ?? `Error ${response.status}`, response.status, body?.details);
  }

  return data as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.details && typeof error.details === "object") {
    const fieldErrors = Object.values(error.details as Record<string, unknown>).filter(
      (value): value is string => typeof value === "string"
    );
    if (fieldErrors.length > 0 && error.status === 400) return `${error.message}: ${fieldErrors.join(" · ")}`;
  }
  return error instanceof Error ? error.message : "Error desconocido";
}

/**
 * Si la API responde 429 por la ventana de rate limit de Ninox y la espera es corta,
 * espera y reintenta una vez en lugar de mostrarle el error al usuario.
 */
export async function withRateLimitRetry<T>(fn: () => Promise<T>, maxWaitSeconds = 15): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const retryAfter = (error as ApiError).details as { retryAfterSeconds?: number } | undefined;
    const seconds = retryAfter?.retryAfterSeconds;
    if (!(error instanceof ApiError) || error.status !== 429 || !seconds || seconds > maxWaitSeconds) throw error;
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000 + 250));
    return fn();
  }
}

// ── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
}

export interface AuthStatus {
  setupRequired: boolean;
  user: User | null;
}

export const auth = {
  status: () => request<AuthStatus>("/api/auth/status"),
  setup: (username: string, password: string) =>
    request<{ user: User }>("/api/auth/setup", { method: "POST", json: { username, password } }),
  login: (username: string, password: string) =>
    request<{ user: User }>("/api/auth/login", { method: "POST", json: { username, password } }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>("/api/auth/password", { method: "POST", json: { currentPassword, newPassword } })
};

// ── Configuración ───────────────────────────────────────────────────────────

export type NinoxEnv = "test" | "prod" | "custom";

export interface NinoxSettings {
  env: NinoxEnv;
  baseUrl: string;
  hasToken: boolean;
  tokenLast4: string | null;
  source: { env: "env" | "db"; baseUrl: "env" | "db"; token: "env" | "db" | "none" };
  ordenIdBase: number;
}

export interface NinoxConfigSnapshot {
  fetchedAt: string;
  config: {
    appId: number;
    nombre: string;
    multiDeposito: boolean;
    flujoDeposito?: number;
    puntoVentaId: number;
    listaPrecioId: number;
    depositos: Array<{ depositoId: number; nombre: string; sucursalNombre?: string | null; default?: boolean }>;
    sucursalesExportacion: Array<{ sucursalId: number; nombre: string }>;
  };
}

export interface RateLimitStatus {
  bucket: string;
  remainingSeconds: number;
  windowSeconds: number;
}

export interface SettingsPayload {
  ninox: NinoxSettings;
  ninoxConfig: NinoxConfigSnapshot | null;
  rateLimits: RateLimitStatus[];
}

export const settings = {
  get: () => request<SettingsPayload>("/api/settings"),
  saveNinox: (input: { env?: NinoxEnv; baseUrl?: string; token?: string; clearToken?: boolean }) =>
    request<{ ninox: NinoxSettings }>("/api/settings/ninox", { method: "PUT", json: input }),
  testNinox: () =>
    withRateLimitRetry(() =>
      request<{ ok: boolean; ninoxConfig: NinoxConfigSnapshot }>("/api/settings/ninox/test", { method: "POST" })
    ),
  saveOrders: (ordenIdBase: number) =>
    request<{ ninox: NinoxSettings }>("/api/settings/orders", { method: "PUT", json: { ordenIdBase } })
};

// ── Catálogo y stock ────────────────────────────────────────────────────────

export interface DashboardSummary {
  hasData: boolean;
  totalProducts: number;
  totalVariants: number;
  totalStock: number;
  outOfStockProducts: number;
  availableColors: number;
  availableSizes: number;
}

export interface SyncStatus {
  configured: boolean;
  syncInProgress: boolean;
  lastSyncAt: string | null;
  lastRunStatus: string | null;
  lastError: string | null;
  nextAllowedInSeconds: number;
  intervalMinutes: number;
}

export interface DashboardPayload {
  status: SyncStatus;
  summary: DashboardSummary;
  facets: { colors: string[]; sizes: string[] };
}

export function getDashboard(): Promise<DashboardPayload> {
  return request("/api/dashboard");
}

export function getProducts(params: URLSearchParams): Promise<ProductsPayload> {
  return request(`/api/products?${params.toString()}`);
}

export function triggerSync(): Promise<{ ok: boolean; articulos: number; status: SyncStatus }> {
  return request("/api/catalog/sync", { method: "POST" });
}

// ── Medios de pago ──────────────────────────────────────────────────────────

export interface Banco {
  bancoId: number;
  nombre: string;
}

export interface Tarjeta {
  tarjetaId: number;
  nombre: string;
  banco?: Banco;
}

export interface TarjetaRegla {
  tarjetaReglaId: number;
  tarjetaId: number;
  cuotas: number;
  porcentaje: number;
  recargo: boolean;
  activo: boolean;
}

export interface CuentaBancaria {
  cuentaBancariaId: number;
  descripcion: string;
  numero?: number;
  banco?: Banco;
}

export interface MediosPagoPayload {
  medios: {
    efectivo?: boolean;
    cuentaCorriente?: boolean;
    tarjeta?: boolean;
    cheque?: boolean;
    deposito?: boolean;
    transferencia?: boolean;
    virtual?: boolean;
  };
  tarjetas: Tarjeta[];
  tarjetasReglas: TarjetaRegla[];
  cuentasBancarias: CuentaBancaria[];
  bancos: Banco[];
}

export function getMediosPago(): Promise<MediosPagoPayload> {
  return withRateLimitRetry(() => request<MediosPagoPayload>("/api/medios-pago"));
}

// ── Pedidos (reservas y ventas) ─────────────────────────────────────────────

export type OrderKind = "preventa" | "venta";
export type OrderStatus = "pending" | "created" | "failed" | "unknown" | "cancelled";

export interface Direccion {
  provincia: string;
  localidad: string;
  direccion: string;
  codigoPostal: string;
}

export interface OrderSubmitPayload {
  detalle?: string;
  entidadId?: number;
  direccionEnvio?: Direccion;
  direccionFacturacion?: Direccion;
  usuario?: {
    nombre: string;
    email: string;
    dni: string;
    cuit: string;
    telefono: string;
    condicion: number;
  };
  productos: Array<{ articuloId: number; precio: number; cantidad: number; talleId?: number; colorId?: number }>;
  subtotal: number;
  descuento: number;
  envio: number;
  recargo: number;
  total: number;
  medioPago?: { tipo: number; cuentaBancariaId?: number; tarjetaId?: number; externalId?: string };
}

export interface OrderRecord {
  id: number;
  kind: OrderKind;
  ordenId: number;
  status: OrderStatus;
  facturaId: number | null;
  clienteNombre: string | null;
  total: number;
  payload: OrderSubmitPayload & { ordenId: number; numero: number };
  response: unknown;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export const orders = {
  list: (params: { kind?: OrderKind; status?: OrderStatus } = {}) => {
    const search = new URLSearchParams();
    if (params.kind) search.set("kind", params.kind);
    if (params.status) search.set("status", params.status);
    return request<{ items: OrderRecord[] }>(`/api/orders?${search.toString()}`);
  },
  nextOrdenId: () => request<{ ordenId: number }>("/api/orders/next-orden-id"),
  create: (kind: OrderKind, payload: OrderSubmitPayload) =>
    request<OrderRecord>(`/api/orders/${kind}`, { method: "POST", json: payload }),
  retry: (id: number) => request<OrderRecord>(`/api/orders/${id}/retry`, { method: "POST" }),
  cancel: (id: number) => request<OrderRecord>(`/api/orders/${id}/cancel`, { method: "POST" }),
  comprobante: (id: number) => request<unknown>(`/api/orders/${id}/comprobante`)
};

// ── Ingesta ─────────────────────────────────────────────────────────────────

export type IngestType =
  | "ventas_items"
  | "ventas_totales"
  | "compras_items"
  | "compras_totales"
  | "stock"
  | "saldos_clientes"
  | "saldos_proveedores";

export interface IngestTypeInfo {
  type: IngestType;
  label: string;
  group: "ventas" | "compras" | "stock" | "saldos";
  enabled: boolean;
}

export interface IngestJob {
  id: number;
  type: IngestType;
  label: string;
  sucursalId: number | null;
  periodo: string | null;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  page: number;
  totalPages: number | null;
  rows: number;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface CoverageRow {
  type: IngestType;
  sucursalId: number;
  periodo: string;
  importedAt: string;
  rows: number;
}

export const ingest = {
  types: () => request<IngestTypeInfo[]>("/api/ingest/types"),
  options: () =>
    request<{
      configFetchedAt: string | null;
      sucursales: Array<{ sucursalId: number; nombre: string }>;
      depositos: Array<{ depositoId: number; nombre: string }>;
    }>("/api/ingest/options"),
  jobs: () => request<{ items: IngestJob[] }>("/api/ingest/jobs"),
  create: (input: { types: IngestType[]; sucursalId: number; desde: string; hasta: string }) =>
    request<{ items: IngestJob[] }>("/api/ingest/jobs", { method: "POST", json: input }),
  cancel: (id: number) => request<IngestJob>(`/api/ingest/jobs/${id}/cancel`, { method: "POST" }),
  retry: (id: number) => request<IngestJob>(`/api/ingest/jobs/${id}/retry`, { method: "POST" }),
  coverage: () => request<{ items: CoverageRow[] }>("/api/ingest/coverage"),
  csvUrl: (table: string, desde: string, hasta: string, sucursalId?: number) => {
    const search = new URLSearchParams({ desde, hasta });
    if (sucursalId) search.set("sucursalId", String(sucursalId));
    return `/api/ingest/export/${table}.csv?${search.toString()}`;
  }
};

// ── Reportes ────────────────────────────────────────────────────────────────

export interface MonthlyRow {
  periodo: string;
  ventasBrutas: number;
  notasCredito: number;
  ventasNetas: number;
  comprobantes: number;
  ticketPromedio: number;
  unidades: number;
  ventasItems: number;
  costo: number;
  margenBruto: number;
  margenPorcentaje: number | null;
  comprasNetas: number;
  comprobantesCompra: number;
}

export interface ReportCoverage {
  ventasTotales: string[];
  ventasItems: string[];
  comprasTotales: string[];
  comprasItems: string[];
}

function reportQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  return search.toString();
}

export const reports = {
  sucursales: () => request<{ items: Array<{ sucursalId: number; nombre: string }> }>("/api/reports/sucursales"),
  monthly: (params: { desde?: string; hasta?: string; sucursalId?: number }) =>
    request<{ desde: string; hasta: string; months: MonthlyRow[]; coverage: ReportCoverage }>(
      `/api/reports/monthly?${reportQuery(params)}`
    ),
  topProducts: (params: { mes: string; sucursalId?: number }) =>
    request<{ periodo: string; items: Array<{ codigo: string; descripcion: string; unidades: number; importe: number }> }>(
      `/api/reports/top-products?${reportQuery(params)}`
    ),
  paymentMethods: (params: { mes: string; sucursalId?: number }) =>
    request<{ periodo: string; items: Array<{ tipo: number; medio: string; importe: number }> }>(
      `/api/reports/payment-methods?${reportQuery(params)}`
    )
};
