/**
 * Contrato de la API "Integración de terceros" de NinoxNet.
 * Referencia: https://docs.ninox.com.ar/docs/terceros
 *
 * Notas del contrato real:
 * - JSON en camelCase, enums como enteros.
 * - Los DateTime llegan como string "dd/MM/yyyy HH:mm:ss" (UTC). Ver ninox/dates.ts.
 */

// ── Configuración ───────────────────────────────────────────────────────────

export interface NinoxDeposito {
  depositoId: number;
  nombre: string;
  direccion?: string;
  eliminado?: boolean;
  sucursalId?: number | null;
  sucursalNombre?: string | null;
  default?: boolean;
}

export interface NinoxSucursalHabilitada {
  sucursalId: number;
  nombre: string;
}

export interface NinoxConfig {
  appId: number;
  nombre: string;
  multiDeposito: boolean;
  /** 3 = multidepósito informativo (el webhook incluye stockDepositos). */
  flujoDeposito?: number;
  depositos: NinoxDeposito[];
  /** Vacío => las exportaciones y saldos responden 403 (deny-by-default). */
  sucursalesExportacion: NinoxSucursalHabilitada[];
  puntoVentaId: number;
  listaPrecioId: number;
  listaPrecioRebajaId?: number | null;
  facturacion?: {
    facturacionAutomatica: boolean;
    puntoVentaFacturacionId: number;
    puntoVentaElectronicoId?: number | null;
  } | null;
  mediosPago?: Array<{
    tipoMedioPago: number;
    tipoMedioPagoIntegracion?: string | null;
    cuentaBancariaId?: number | null;
    electronica: boolean;
  }>;
}

// ── Catálogo (GetData) ──────────────────────────────────────────────────────

export interface NinoxArticuloCurva {
  articuloId: number;
  colorId?: number | null;
  talleId?: number | null;
  colorNombre?: string | null;
  colorCodigo?: string | null;
  colorHex?: string | null;
  talleNombre?: string | null;
  talleCodigo?: string | null;
  codigoBarras?: string | null;
  unidades?: number | null;
  stockDepositos?: Array<{ depositoId: number; unidades: number }>;
}

/** tipo: -1 TODAS, 0 TAG, 1 CATEGORIA, 2 MARCA, 3 TEMPORADA */
export interface NinoxArticuloTag {
  articuloId: number;
  articuloTagId?: number;
  tipo: number;
  tagId: number;
  tagNombre: string;
  padreId?: number | null;
  destacada?: boolean;
}

/** talleColor: 0 NINGUNO, 1 TALLES, 2 COLORES, 3 TALLES_COLORES */
export interface NinoxArticulo {
  articuloId: number;
  codigo: string;
  descripcion?: string | null;
  descripcionWeb?: string | null;
  nombre?: string | null;
  talleColor?: number;
  precio1?: number | null;
  precio2?: number | null;
  precio3?: number | null;
  precio4?: number | null;
  precio5?: number | null;
  stockTotal?: number | null;
  imagen?: string | null;
  curva?: NinoxArticuloCurva[] | null;
  tags?: NinoxArticuloTag[] | null;
}

// ── Comprobantes ────────────────────────────────────────────────────────────

export interface NinoxDireccion {
  provincia: string;
  localidad: string;
  direccion: string;
  codigoPostal: string;
}

/** condicion: CondicionIva 0 SIN_CATEGORIA, 1 CF, 2 RI, 3 MONO, 4 EXENTO, 5 RNI */
export interface NinoxUsuario {
  nombre: string;
  email: string;
  dni: string;
  cuit: string;
  telefono: string;
  condicion: number;
}

export interface NinoxProductoPedido {
  articuloId: number;
  precio: number;
  cantidad: number;
  talleId?: number;
  colorId?: number;
}

export interface NinoxPedido {
  ordenId: number;
  numero: number;
  detalle?: string;
  listaPrecioId?: number;
  direccionEnvio?: NinoxDireccion;
  direccionFacturacion?: NinoxDireccion;
  /** Obligatorio (con dni, cuit o email) salvo que se envíe entidadId. */
  usuario?: NinoxUsuario;
  entidadId?: number;
  empleadoId?: number;
  productos: NinoxProductoPedido[];
  subtotal: number;
  descuento: number;
  envio: number;
  recargo: number;
  total: number;
}

/** TipoMedio: 1 EFECTIVO, 5 TARJETA, 6 CUENTA_CORRIENTE, 9 DEPOSITO_BANCO, 11 VIRTUAL */
export interface NinoxMedioPago {
  tipo: number;
  cuentaBancariaId?: number;
  tarjetaId?: number;
  externalId?: string;
}

export interface NinoxVenta extends NinoxPedido {
  medioPago: NinoxMedioPago;
}

/** Respuesta de Pedido / venta / notacredito / facturar. Éxito solo si facturaId > 0. */
export interface NinoxFacturaResult {
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
}

/** tipo: 0 ERROR, 1 OK, 2 VALIDACION */
export interface NinoxResultado {
  tipo: number;
  id?: number;
  data?: unknown;
  valores?: string[];
  mensajes?: string[];
  errores?: string[];
}

/** comprobanteTipo: 2 VENTA, 4 NOTA_CREDITO, 33 PREVENTA */
export interface NinoxComprobante {
  facturaId: number;
  ordenId?: string | null;
  comprobanteTipo: number;
  estado: number;
  numero?: number;
  pVNumero?: number;
  fecha?: string | null;
  sucursalId?: number;
  puntoVentaId?: number;
  empleadoId?: number | null;
  sref?: string | null;
  totales?: {
    subTotal: number;
    descuento: number;
    recargo: number;
    envio: number;
    total: number;
    pagado: number;
    saldo: number;
  };
  items?: Array<{
    articuloId: number;
    descripcion: string;
    talleId?: number | null;
    colorId?: number | null;
    cantidad: number;
    precio: number;
    subtotal: number;
  }>;
}

// ── Exportaciones paginadas ─────────────────────────────────────────────────

export interface NinoxPaginado<T> {
  items: T[];
  totalRegistros: number;
  totalPaginas: number;
  paginaActual: number;
  pageSize: number;
}

export interface NinoxFormaPago {
  facturaId: number;
  tipo: number;
  tipoText?: string | null;
  detalle?: string | null;
  importe: number;
}

interface NinoxComprobanteExportBase {
  facturaId: number;
  /** Venta: 2 FV, 4 NC. Compra: 1 FC, 3 NC. */
  comprobanteTipo: number;
  /** A=1, B=2, C=3, E=4, R=5, X=6, M=7 */
  tipoDocumento?: number | null;
  fecha?: string | null;
  fechaText: string;
  horaText?: string | null;
  numeroFull?: string | null;
  sucursalId: number;
  sucursal?: string | null;
  appId?: number | null;
  detalle?: string | null;
  formasPagoText?: string | null;
  formasPago?: NinoxFormaPago[] | null;
}

export interface NinoxVentaItem extends NinoxComprobanteExportBase {
  cliente?: string | null;
  vendedor?: string | null;
  codigo?: string | null;
  descripcion?: string | null;
  talle?: string | null;
  color?: string | null;
  cantidad: number;
  costoItem?: number | null;
  costoArticulo?: number | null;
  /** Precio unitario de lista del ítem. */
  precioVenta?: number | null;
  /** Precio unitario final del ítem (con descuentos/recargos de línea). */
  precioVentaFinal?: number | null;
  precioLista1?: number | null;
  precioLista2?: number | null;
}

export interface NinoxVentaTotal extends NinoxComprobanteExportBase {
  cliente?: string | null;
  vendedor?: string | null;
  email?: string | null;
  dni?: string | null;
  subTotal: number;
  total: number;
  descuento: number;
  recargo: number;
  iva: number;
  impuestosTotal: number;
  cantidad: number;
}

export interface NinoxCompraItem extends NinoxComprobanteExportBase {
  depositoId?: number | null;
  lote?: string | null;
  proveedor?: string | null;
  empleado?: string | null;
  codigo?: string | null;
  descripcion?: string | null;
  talle?: string | null;
  color?: string | null;
  cantidad: number;
  costoItem?: number | null;
  costoArticulo?: number | null;
  precioCompra?: number | null;
  precioCompraFinal?: number | null;
}

export interface NinoxCompraTotal extends NinoxComprobanteExportBase {
  proveedor?: string | null;
  empleado?: string | null;
  subTotal: number;
  total: number;
  descuento: number;
  recargo: number;
  iva: number;
  impuestosTotal: number;
  cantidad: number;
}

export type ExportKind = "ventaitems" | "ventatotales" | "compraitems" | "compratotales";

export interface ExportParams {
  sucursalId: number;
  anio: number;
  mes: number;
  page: number;
  pageSize: number;
  incluirMediosPago?: boolean;
}

// ── Stock y saldos (preparados) ─────────────────────────────────────────────

export interface NinoxStockItem {
  articuloId: number;
  codigo?: string | null;
  descripcion?: string | null;
  sucursalId?: number | null;
  sucursal?: string | null;
  depositoId?: number | null;
  deposito?: string | null;
  colorId?: number | null;
  colorNombre?: string | null;
  talleId?: number | null;
  talleNombre?: string | null;
  cantidad: number;
  reservado: number;
  total: number;
}

export interface NinoxStockPage {
  registros: number;
  cantidad: number;
  reservado: number;
  total: number;
  stock: NinoxStockItem[];
}

export interface NinoxSaldoItem {
  entidadId: number;
  nombre: string;
  razonSocial?: string | null;
  saldo: number;
  cantidadFacturas: number;
  saldo15: number;
  saldo30: number;
  saldo60: number;
  saldo90: number;
  saldo90Mas: number;
  totalUltimoPago?: number | null;
  fechaUltimoPago?: string | null;
}

export interface NinoxSaldosPaginado {
  saldos: NinoxSaldoItem[];
  totalRegistros: number;
  totalFiltrados: number;
  saldoTotal: number;
}
