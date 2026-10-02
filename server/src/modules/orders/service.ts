import type { AppContext } from "../../context.js";
import { HttpError } from "../../lib/http.js";
import { NinoxApiError, NinoxNetworkError } from "../../ninox/client.js";
import type { NinoxComprobante, NinoxFacturaResult, NinoxPedido, NinoxVenta } from "../../ninox/types.js";
import { validateOrderBody, type OrderKind } from "./validation.js";

export type OrderStatus = "pending" | "created" | "failed" | "unknown" | "cancelled";

export interface OrderRecord {
  id: number;
  kind: OrderKind;
  ordenId: number;
  status: OrderStatus;
  facturaId: number | null;
  clienteNombre: string | null;
  total: number;
  payload: NinoxPedido | NinoxVenta;
  response: unknown;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

interface OrderRow {
  id: number;
  kind: OrderKind;
  orden_id: number;
  status: OrderStatus;
  factura_id: number | null;
  cliente_nombre: string | null;
  total: number;
  payload_json: string;
  response_json: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

function toRecord(row: OrderRow): OrderRecord {
  return {
    id: row.id,
    kind: row.kind,
    ordenId: row.orden_id,
    status: row.status,
    facturaId: row.factura_id,
    clienteNombre: row.cliente_nombre,
    total: row.total,
    payload: JSON.parse(row.payload_json) as NinoxPedido,
    response: row.response_json ? (JSON.parse(row.response_json) as unknown) : null,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/** Ninox considera exitoso el comprobante solo si facturaId > 0; si no, el motivo viene en `datos`. */
function resultError(result: NinoxFacturaResult | null): string | null {
  if (result && typeof result.facturaId === "number" && result.facturaId > 0) return null;
  const datos = result?.datos && Object.values(result.datos).filter(Boolean);
  if (datos && datos.length > 0) return datos.join(" | ");
  return result?.observaciones || result?.errorFE || "Ninox no devolvió un facturaId válido";
}

/**
 * Reservas (preventas vía POST Pedido) y ventas (POST venta).
 *
 * Idempotencia: la orden se registra como `pending` ANTES de llamar a Ninox con un
 * ordenId único. Si la llamada termina en timeout/error de red queda `unknown` y el
 * reintento reutiliza el mismo ordenId, así Ninox puede detectar el duplicado.
 */
export class OrdersService {
  constructor(private readonly ctx: AppContext) {}

  nextOrdenId(): number {
    const row = this.ctx.db.prepare("SELECT MAX(orden_id) AS max FROM orders").get() as { max: number | null };
    return Math.max((row.max ?? 0) + 1, this.ctx.settings.getOrdenIdBase());
  }

  list(filters: { kind?: OrderKind; status?: OrderStatus; limit?: number }): OrderRecord[] {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filters.kind) {
      where.push("kind = ?");
      params.push(filters.kind);
    }
    if (filters.status) {
      where.push("status = ?");
      params.push(filters.status);
    }
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    const rows = this.ctx.db
      .prepare(
        `SELECT * FROM orders ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC LIMIT ${limit}`
      )
      .all(...params) as OrderRow[];
    return rows.map(toRecord);
  }

  get(id: number): OrderRecord {
    const row = this.ctx.db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
    if (!row) throw new HttpError(404, "Pedido no encontrado");
    return toRecord(row);
  }

  async create(kind: OrderKind, body: unknown, userId: number): Promise<OrderRecord> {
    const { errors, payload } = validateOrderBody(body, kind);
    if (!payload) throw new HttpError(400, "Revisá los datos del pedido", errors);

    // Verifica la conexión antes de reservar el ordenId.
    this.ctx.ninox();

    const now = new Date().toISOString();
    const orderId = this.ctx.db.transaction(() => {
      const ordenId = this.nextOrdenId();
      const full = { ...payload, ordenId, numero: ordenId };
      const result = this.ctx.db
        .prepare(
          `INSERT INTO orders (kind, orden_id, status, cliente_nombre, total, payload_json, created_by, created_at, updated_at)
           VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?)`
        )
        .run(kind, ordenId, payload.usuario?.nombre ?? (payload.entidadId ? `Entidad #${payload.entidadId}` : null), payload.total, JSON.stringify(full), userId, now, now);
      return Number(result.lastInsertRowid);
    })();

    return this.submit(orderId);
  }

  /** Reintenta una orden fallida o en estado desconocido con el MISMO ordenId. */
  async retry(id: number): Promise<OrderRecord> {
    const order = this.get(id);
    if (order.status !== "failed" && order.status !== "unknown") {
      throw new HttpError(409, `No se puede reintentar un pedido en estado ${order.status}`);
    }
    return this.submit(id);
  }

  async cancel(id: number): Promise<OrderRecord> {
    const order = this.get(id);
    if (order.kind !== "preventa" || order.status !== "created" || !order.facturaId) {
      throw new HttpError(409, "Solo se pueden cancelar reservas creadas en Ninox");
    }

    const result = await this.ctx.ninox().cancelarPedido(order.facturaId);
    if (result?.tipo !== 1) {
      const detail = [...(result?.errores ?? []), ...(result?.mensajes ?? [])].join(" | ");
      throw new HttpError(502, detail || "Ninox no confirmó la cancelación", result);
    }

    this.update(id, { status: "cancelled", response: { ...((order.response as object) ?? {}), cancelacion: result } });
    return this.get(id);
  }

  async comprobante(id: number): Promise<NinoxComprobante> {
    const order = this.get(id);
    if (!order.facturaId) throw new HttpError(409, "El pedido no tiene comprobante en Ninox");
    return this.ctx.ninox().getComprobante(order.facturaId);
  }

  private async submit(id: number): Promise<OrderRecord> {
    const order = this.get(id);
    const client = this.ctx.ninox();
    this.update(id, { status: "pending", error: null });

    try {
      const result =
        order.kind === "venta"
          ? await client.createVenta(order.payload as NinoxVenta)
          : await client.createPedido(order.payload);

      const error = resultError(result);
      this.update(id, {
        status: error ? "failed" : "created",
        facturaId: error ? null : (result.facturaId ?? null),
        response: result,
        error
      });
    } catch (error) {
      if (error instanceof NinoxNetworkError && !error.sent) {
        // La request nunca llegó a Ninox: se puede reintentar sin riesgo de duplicar.
        this.update(id, { status: "failed", error: error.message });
      } else if (error instanceof NinoxNetworkError) {
        this.update(id, { status: "unknown", error: `${error.message}. Verificá en Ninox antes de reintentar.` });
      } else if (error instanceof NinoxApiError) {
        this.update(id, { status: "failed", error: error.message });
      } else {
        this.update(id, { status: "failed", error: error instanceof Error ? error.message : String(error) });
      }
    }

    return this.get(id);
  }

  private update(
    id: number,
    patch: { status?: OrderStatus; facturaId?: number | null; response?: unknown; error?: string | null }
  ): void {
    const sets: string[] = ["updated_at = @updated_at"];
    const params: Record<string, unknown> = { id, updated_at: new Date().toISOString() };
    if (patch.status !== undefined) {
      sets.push("status = @status");
      params.status = patch.status;
    }
    if (patch.facturaId !== undefined) {
      sets.push("factura_id = @factura_id");
      params.factura_id = patch.facturaId;
    }
    if (patch.response !== undefined) {
      sets.push("response_json = @response_json");
      params.response_json = JSON.stringify(patch.response);
    }
    if (patch.error !== undefined) {
      sets.push("error = @error");
      params.error = patch.error;
    }
    this.ctx.db.prepare(`UPDATE orders SET ${sets.join(", ")} WHERE id = @id`).run(params);
  }
}
