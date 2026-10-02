import type { NinoxDireccion, NinoxMedioPago, NinoxPedido, NinoxProductoPedido, NinoxUsuario } from "../../ninox/types.js";

export type OrderKind = "preventa" | "venta";

/** Medios que acepta POST /venta en la práctica: efectivo, depósito bancario y virtual. */
export const VENTA_MEDIOS_SOPORTADOS = [1, 9, 11];

export type ValidationErrors = Record<string, string>;

type Loose = Record<string, unknown>;

function isRecord(value: unknown): value is Loose {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function number(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function optionalInt(value: unknown): number | undefined {
  const parsed = number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function direccion(value: unknown): NinoxDireccion | undefined {
  if (!isRecord(value)) return undefined;
  const result = {
    provincia: text(value.provincia),
    localidad: text(value.localidad),
    direccion: text(value.direccion),
    codigoPostal: text(value.codigoPostal)
  };
  return Object.values(result).some(Boolean) ? result : undefined;
}

export const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Valida el cuerpo que manda el frontend y arma el payload de Ninox (sin ordenId/numero,
 * que asigna el servidor). Reglas del contrato:
 * - entidadId, o usuario con al menos dni, cuit o email.
 * - total = subtotal + envio + recargo - descuento (si no, Ninox responde 422).
 */
export function validateOrderBody(
  body: unknown,
  kind: OrderKind
): { errors: ValidationErrors; payload?: Omit<NinoxPedido, "ordenId" | "numero"> & { medioPago?: NinoxMedioPago } } {
  const errors: ValidationErrors = {};
  if (!isRecord(body)) return { errors: { _root: "Payload inválido" } };

  const entidadId = optionalInt(body.entidadId);
  let usuario: NinoxUsuario | undefined;
  if (isRecord(body.usuario)) {
    usuario = {
      nombre: text(body.usuario.nombre),
      email: text(body.usuario.email),
      dni: text(body.usuario.dni),
      cuit: text(body.usuario.cuit),
      telefono: text(body.usuario.telefono),
      condicion: Number.isInteger(number(body.usuario.condicion)) ? number(body.usuario.condicion) : 1
    };
  }

  if (!entidadId) {
    if (!usuario) {
      errors.usuario = "Indicá los datos del cliente o un entidadId existente";
    } else {
      if (!usuario.nombre) errors["usuario.nombre"] = "El nombre del cliente es requerido";
      if (!usuario.dni && !usuario.cuit && !usuario.email) {
        errors["usuario.dni"] = "Indicá DNI, CUIT o email del cliente";
      }
      if (usuario.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(usuario.email)) {
        errors["usuario.email"] = "Email inválido";
      }
    }
  }

  const productos: NinoxProductoPedido[] = [];
  if (!Array.isArray(body.productos) || body.productos.length === 0) {
    errors.productos = "Agregá al menos un artículo";
  } else {
    body.productos.forEach((item, index) => {
      if (!isRecord(item)) {
        errors[`productos.${index}`] = "Artículo inválido";
        return;
      }
      const articuloId = optionalInt(item.articuloId);
      const cantidad = number(item.cantidad);
      const precio = number(item.precio);
      if (!articuloId) errors[`productos.${index}.articuloId`] = "articuloId inválido";
      if (!(cantidad > 0)) errors[`productos.${index}.cantidad`] = "La cantidad debe ser mayor a 0";
      if (!(precio >= 0)) errors[`productos.${index}.precio`] = "Precio inválido";
      productos.push({
        articuloId: articuloId ?? 0,
        cantidad,
        precio: round2(precio),
        talleId: optionalInt(item.talleId),
        colorId: optionalInt(item.colorId)
      });
    });
  }

  const subtotal = round2(productos.reduce((sum, p) => sum + p.precio * p.cantidad, 0));
  const descuento = round2(number(body.descuento ?? 0));
  const envio = round2(number(body.envio ?? 0));
  const recargo = round2(number(body.recargo ?? 0));
  for (const [key, value] of Object.entries({ descuento, envio, recargo })) {
    if (!(value >= 0)) errors[key] = `${key} debe ser un número mayor o igual a 0`;
  }
  const total = round2(subtotal + envio + recargo - descuento);
  if (body.total !== undefined && Math.abs(number(body.total) - total) > 0.01) {
    errors.total = `El total (${body.total}) no coincide con subtotal + envío + recargo - descuento (${total.toFixed(2)})`;
  }
  if (!(total > 0)) errors.total = "El total debe ser mayor a 0";

  let medioPago: NinoxMedioPago | undefined;
  if (kind === "venta") {
    const medio = isRecord(body.medioPago) ? body.medioPago : undefined;
    const tipo = medio ? number(medio.tipo) : NaN;
    if (!VENTA_MEDIOS_SOPORTADOS.includes(tipo)) {
      errors.medioPago = "Para ventas elegí efectivo, transferencia/depósito o virtual";
    } else {
      medioPago = {
        tipo,
        cuentaBancariaId: optionalInt(medio?.cuentaBancariaId),
        tarjetaId: optionalInt(medio?.tarjetaId),
        externalId: text(medio?.externalId) || undefined
      };
      if (tipo === 9 && !medioPago.cuentaBancariaId) {
        errors["medioPago.cuentaBancariaId"] = "Elegí la cuenta bancaria";
      }
    }
  }

  if (Object.keys(errors).length > 0) return { errors };

  return {
    errors,
    payload: {
      detalle: text(body.detalle) || undefined,
      direccionEnvio: direccion(body.direccionEnvio),
      direccionFacturacion: direccion(body.direccionFacturacion),
      usuario: entidadId ? undefined : usuario,
      entidadId,
      empleadoId: optionalInt(body.empleadoId),
      productos,
      subtotal,
      descuento,
      envio,
      recargo,
      total,
      medioPago
    }
  };
}
