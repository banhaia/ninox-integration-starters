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
  configuredSourceIds: string[];
  hasConfiguredSources: boolean;
  syncInProgress: boolean;
  lastSyncAt: string | null;
  lastSyncSource: string | null;
  syncError: string | null;
}

export interface DashboardPayload {
  status: SyncStatus;
  summary: DashboardSummary;
  facets: {
    colors: string[];
    sizes: string[];
  };
}

export interface StockRow {
  articuloId: number | null;
  code: string;
  name: string;
  description?: string;
  stock: number | null;
  categories: string[];
  tags: string[];
  price: number | null;
  colors: string[];
  sizes: string[];
  variants: Array<{
    code?: string;
    name: string;
    stock: number | null;
    talleId?: number;
    colorId?: number;
  }>;
}

export interface ProductsPayload {
  items: StockRow[];
  total: number;
  filters: {
    search: string;
    color: string;
    size: string;
  };
  facets: {
    colors: string[];
    sizes: string[];
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getDashboard(): Promise<DashboardPayload> {
  return request("/api/dashboard");
}

export function getProducts(params: URLSearchParams): Promise<ProductsPayload> {
  return request(`/api/products?${params.toString()}`);
}

export function triggerSync(): Promise<{ started: boolean; message: string }> {
  return request("/api/sync", {
    method: "POST"
  });
}

// ── Medios de pago ────────────────────────────────────────────────────────────

export interface Banco {
  bancoId: number;
  nombre: string;
}

export interface Tarjeta {
  tarjetaId: number;
  nombre: string;
  tipo?: number;
  bancoId?: number;
  cuentaBancariaId?: number;
  monedaId?: number;
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
  numero: number;
  bancoId?: number;
  monedaId?: number;
  chequera?: boolean;
  entidadId?: number;
  banco?: Banco;
}

export interface MediosPagoPayload {
  medios: {
    efectivo?: boolean;
    cuentaCorriente?: boolean;
    tarjeta?: boolean;
    cheque?: boolean;
    deposito?: boolean;
    virtual?: boolean;
  };
  tarjetas: Tarjeta[];
  tarjetasReglas: TarjetaRegla[];
  cuentasBancarias: CuentaBancaria[];
  bancos: Banco[];
}

// ── Preventa / Venta ──────────────────────────────────────────────────────────

// Contrato camelCase según PedidoTerceros / ArticuloTerceros de Ninox
export interface PreventaLineItem {
  articuloId: number;
  precio: number;
  cantidad: number;
  talleId?: number;
  colorId?: number;
}

export interface PreventaSubmitPayload {
  ordenId: number;
  numero: number;
  detalle?: string;
  direccionEnvio: {
    provincia: string;
    localidad: string;
    direccion: string;
    codigoPostal: string;
  };
  direccionFacturacion: {
    provincia: string;
    localidad: string;
    direccion: string;
    codigoPostal: string;
  };
  usuario: {
    nombre: string;
    email: string;
    dni: string;
    cuit: string;
    telefono: string;
    condicion: number;
  };
  productos: PreventaLineItem[];
  subtotal: number;
  descuento: number;
  envio: number;
  recargo: number;
  total: number;
}

// PedidoResultado según esquema oficial de Ninox
export interface PreventaResult {
  facturaId?: number;
  numero?: number;
  pVNumero?: number;
  sref?: string | null;
  estado?: number;
  datos?: Record<string, string> | null;
  electronica?: boolean;
  cae?: string | null;
  caevencimiento?: string | null;
  resultado?: string | null;
  observaciones?: string | null;
  errorFE?: string | null;
  saldo?: number | null;
  errores?: boolean;
  // proxy/validation errors from our own backend
  error?: string;
  errors?: Record<string, string>;
}

export function getMediosPago(): Promise<MediosPagoPayload> {
  return request("/api/medios-pago");
}

// ── Historial ─────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string;
  timestamp: string;
  type: "preventa" | "venta";
  payload: PreventaSubmitPayload;
  result: PreventaResult;
}

export function getPreventaHistory(): Promise<HistoryEntry[]> {
  return request("/api/preventa-history");
}

export function createPreventa(body: PreventaSubmitPayload): Promise<PreventaResult> {
  return request("/api/preventas", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function createVenta(body: PreventaSubmitPayload): Promise<PreventaResult> {
  return request("/api/ventas", {
    method: "POST",
    body: JSON.stringify(body)
  });
}
