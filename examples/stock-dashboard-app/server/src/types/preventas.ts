// Contratos camelCase según esquema oficial de Ninox
// Ref: /docs/integraciones/terceros/esquema

export interface DireccionTerceros {
  provincia: string;
  localidad: string;
  direccion: string;
  codigoPostal: string;
}

export interface UsuarioTerceros {
  nombre: string;
  email: string;
  dni: string;
  cuit: string;
  telefono: string;
  condicion: number; // CondicionIva 0-5
}

export interface ArticuloTerceros {
  articuloId: number;
  precio: number;
  cantidad: number;
  talleId?: number;
  colorId?: number;
}

export interface PedidoTerceros {
  ordenId: number;
  numero: number;
  detalle?: string;
  direccionEnvio: DireccionTerceros;
  direccionFacturacion: DireccionTerceros;
  productos: ArticuloTerceros[];
  usuario: UsuarioTerceros;
  subtotal: number;
  descuento: number;
  envio: number;
  recargo: number;
  total: number;
}

export interface ValidationErrors {
  [field: string]: string;
}

export function validateSaleBody(body: unknown): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!body || typeof body !== "object") {
    return { _root: "Payload inválido" };
  }

  const b = body as Record<string, unknown>;

  if (b.ordenId === undefined || b.ordenId === null || b.ordenId === "") {
    errors.ordenId = "ordenId es requerido";
  }
  if (b.numero === undefined || b.numero === null || b.numero === "") {
    errors.numero = "numero es requerido";
  }

  const u = b.usuario as Record<string, unknown> | undefined;
  if (!u) {
    errors.usuario = "Datos de usuario requeridos";
  } else {
    if (!u.nombre) errors["usuario.nombre"] = "nombre es requerido";
    if (!u.email) errors["usuario.email"] = "email es requerido";
    if (!u.dni && !u.cuit) errors["usuario.dni"] = "dni o cuit es requerido";
  }

  const productos = b.productos as unknown[];
  if (!Array.isArray(productos) || productos.length === 0) {
    errors.productos = "Debe incluir al menos un artículo";
  }

  const subtotal = Number(b.subtotal ?? 0);
  const descuento = Number(b.descuento ?? 0);
  const recargo = Number(b.recargo ?? 0);
  const envio = Number(b.envio ?? 0);
  const total = Number(b.total ?? 0);
  const expected = subtotal + envio + recargo - descuento;

  if (Math.abs(total - expected) > 0.01) {
    errors.total = `total (${total}) no coincide con subtotal + envio + recargo - descuento (${expected.toFixed(2)})`;
  }

  return errors;
}
