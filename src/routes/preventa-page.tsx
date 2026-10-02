import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BookMarked, Download, ShoppingCart, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OrderHeader } from "@/components/preventa/order-header";
import { CustomerForm } from "@/components/preventa/customer-form";
import { ArticleSearch } from "@/components/preventa/article-search";
import { LineItemsTable } from "@/components/preventa/line-items-table";
import { TotalsPanel } from "@/components/preventa/totals-panel";
import { PaymentSelector } from "@/components/preventa/payment-selector";
import { ResultBanner } from "@/components/preventa/result-banner";
import { errorMessage, getMediosPago, orders } from "@/lib/api";
import type { MediosPagoPayload, OrderKind, OrderSubmitPayload } from "@/lib/api";
import {
  INITIAL_FORM_STATE,
  TIPO_MEDIO,
  VENTA_MEDIOS_SOPORTADOS,
  type FormDireccion,
  type FormLinea,
  type FormMedioPago,
  type PreventaFormState
} from "@/lib/preventa-types";

const DRAFT_KEY = "ninox-preventa-draft";

interface SubmitResult {
  tone: "success" | "error" | "warning";
  message: string;
}

function validateForm(state: PreventaFormState, total: number, kind: OrderKind): Record<string, string> {
  const errors: Record<string, string> = {};
  const hasEntidad = Boolean(state.entidadId.trim());

  if (!hasEntidad) {
    if (!state.usuario.Nombre.trim()) errors["Usuario.Nombre"] = "Nombre es requerido";
    if (!state.usuario.Dni.trim() && !state.usuario.Cuit.trim() && !state.usuario.Email.trim()) {
      errors["Usuario.Dni"] = "Indicá DNI, CUIT o email del cliente";
    }
  }
  if (state.usuario.Email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.usuario.Email)) {
    errors["Usuario.Email"] = "Email inválido";
  }
  if (state.lineas.length === 0) errors.Productos = "Debe agregar al menos un artículo";
  if (total <= 0) errors.Total = "El total debe ser mayor a 0";

  if (kind === "venta") {
    if (!state.medioPago.tipo || !VENTA_MEDIOS_SOPORTADOS.includes(state.medioPago.tipo)) {
      errors.MedioPago = "Para una venta elegí efectivo, transferencia o virtual";
    } else if (state.medioPago.tipo === TIPO_MEDIO.DEPOSITO_BANCO && !state.medioPago.cuentaBancariaId) {
      errors["MedioPago.CuentaBancariaId"] = "Elegí la cuenta bancaria";
    }
  }

  return errors;
}

function direccion(value: FormDireccion) {
  return {
    provincia: value.Provincia,
    localidad: value.Localidad,
    direccion: value.Direccion,
    codigoPostal: value.CodigoPostal
  };
}

function buildPayload(state: PreventaFormState, subtotal: number, total: number, kind: OrderKind): OrderSubmitPayload {
  const entidadId = Number(state.entidadId);
  return {
    detalle: state.detalle || undefined,
    entidadId: Number.isInteger(entidadId) && entidadId > 0 ? entidadId : undefined,
    direccionEnvio: direccion(state.envio),
    direccionFacturacion: direccion(state.facturacion),
    usuario: {
      nombre: state.usuario.Nombre,
      email: state.usuario.Email,
      dni: state.usuario.Dni,
      cuit: state.usuario.Cuit,
      telefono: state.usuario.Telefono,
      condicion: state.usuario.Condicion
    },
    productos: state.lineas.map((l) => ({
      articuloId: l.articleId,
      precio: l.precio,
      cantidad: l.cantidad,
      talleId: l.talleId,
      colorId: l.colorId
    })),
    subtotal,
    descuento: state.descuento,
    envio: state.envioMonto,
    recargo: state.recargo,
    total,
    medioPago:
      kind === "venta" && state.medioPago.tipo
        ? {
            tipo: state.medioPago.tipo,
            cuentaBancariaId: state.medioPago.cuentaBancariaId,
            tarjetaId: state.medioPago.tarjetaId,
            externalId: state.medioPago.externalId
          }
        : undefined
  };
}

export function PreventaPage() {
  const [form, setForm] = useState<PreventaFormState>({ ...INITIAL_FORM_STATE });
  const [nextOrdenId, setNextOrdenId] = useState<number | null>(null);
  const [mediosPago, setMediosPago] = useState<MediosPagoPayload | null>(null);
  const [mediosLoading, setMediosLoading] = useState(true);
  const [mediosError, setMediosError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<OrderKind | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasDraft, setHasDraft] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadNextOrdenId = useCallback(() => {
    orders
      .nextOrdenId()
      .then((data) => setNextOrdenId(data.ordenId))
      .catch(() => setNextOrdenId(null));
  }, []);

  const loadMediosPago = useCallback(() => {
    let cancelled = false;
    setMediosLoading(true);
    setMediosError(null);
    getMediosPago()
      .then((data) => {
        if (!cancelled) setMediosPago(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setMediosError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setMediosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cleanup = loadMediosPago();
    loadNextOrdenId();
    setHasDraft(Boolean(localStorage.getItem(DRAFT_KEY)));
    return cleanup;
  }, [loadMediosPago, loadNextOrdenId]);

  const subtotal = useMemo(() => form.lineas.reduce((sum, l) => sum + l.precio * l.cantidad, 0), [form.lineas]);
  const total = useMemo(
    () => subtotal + form.envioMonto + form.recargo - form.descuento,
    [subtotal, form.envioMonto, form.recargo, form.descuento]
  );

  function patchForm(patch: Partial<PreventaFormState>): void {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function addLine(line: FormLinea): void {
    setForm((prev) => ({ ...prev, lineas: [...prev.lineas, line] }));
  }

  function removeLine(index: number): void {
    setForm((prev) => ({ ...prev, lineas: prev.lineas.filter((_, i) => i !== index) }));
  }

  function updateLineCantidad(index: number, cantidad: number): void {
    setForm((prev) => ({ ...prev, lineas: prev.lineas.map((l, i) => (i === index ? { ...l, cantidad } : l)) }));
  }

  // ── Borradores (solo en este navegador) ────────────────────────────────────

  function saveDraft(): void {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    setHasDraft(true);
  }

  function applyDraft(raw: string): void {
    try {
      setForm({ ...INITIAL_FORM_STATE, ...(JSON.parse(raw) as Partial<PreventaFormState>) });
      setErrors({});
    } catch {
      // borrador inválido: se ignora
    }
  }

  function downloadDraft(): void {
    const blob = new Blob([JSON.stringify(form, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `borrador-operacion-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => applyDraft(String(ev.target?.result ?? ""));
    reader.readAsText(file);
    e.target.value = "";
  }

  // ── Envío ──────────────────────────────────────────────────────────────────

  async function handleSubmit(kind: OrderKind): Promise<void> {
    const validationErrors = validateForm(form, total, kind);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(kind);
    setSubmitResult(null);
    try {
      const order = await orders.create(kind, buildPayload(form, subtotal, total, kind));
      const label = kind === "preventa" ? "Reserva" : "Venta";

      if (order.status === "created") {
        setSubmitResult({
          tone: "success",
          message: `${label} creada en Ninox. OrdenId ${order.ordenId} · FacturaId ${order.facturaId}`
        });
        localStorage.removeItem(DRAFT_KEY);
        setHasDraft(false);
        setForm({ ...INITIAL_FORM_STATE });
        setErrors({});
      } else if (order.status === "unknown") {
        setSubmitResult({
          tone: "warning",
          message: `No hubo respuesta de Ninox (OrdenId ${order.ordenId}). Revisalo en "Reservas y ventas" antes de reintentar: el reintento usa el mismo ordenId.`
        });
      } else {
        setSubmitResult({ tone: "error", message: order.error ?? "Ninox rechazó la operación" });
      }
    } catch (err) {
      setSubmitResult({ tone: "error", message: errorMessage(err) });
    } finally {
      setSubmitting(null);
      loadNextOrdenId();
    }
  }

  const errorList = Object.values(errors);

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Nueva operación</h1>
            <p className="text-sm text-muted-foreground">
              Creá una reserva (preventa) o una venta directa en Ninox. Todo queda registrado en{" "}
              <Link to="/operaciones" className="underline underline-offset-2">
                Reservas y ventas
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasDraft && (
            <Button
              type="button"
              variant="ghost"
              className="h-8 gap-1.5 px-3 text-xs"
              onClick={() => applyDraft(localStorage.getItem(DRAFT_KEY) ?? "")}
            >
              <BookMarked className="h-3.5 w-3.5" />
              Cargar borrador
            </Button>
          )}
          <Button type="button" variant="ghost" className="h-8 gap-1.5 px-3 text-xs" onClick={saveDraft}>
            <BookMarked className="h-3.5 w-3.5" />
            Guardar borrador
          </Button>
          <Button type="button" variant="ghost" className="h-8 gap-1.5 px-3 text-xs" onClick={downloadDraft}>
            <Download className="h-3.5 w-3.5" />
            Exportar JSON
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-8 gap-1.5 px-3 text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            Importar JSON
          </Button>
          <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileUpload} />
        </div>
      </Card>

      {submitResult && (
        <ResultBanner
          type={submitResult.tone === "success" ? "success" : "error"}
          message={submitResult.message}
          onDismiss={() => setSubmitResult(null)}
        />
      )}

      <OrderHeader
        nextOrdenId={nextOrdenId}
        entidadId={form.entidadId}
        detalle={form.detalle}
        onChange={(field, value) => patchForm({ [field]: value })}
      />

      <CustomerForm
        usuario={form.usuario}
        envio={form.envio}
        facturacion={form.facturacion}
        errors={errors}
        onChangeUsuario={(patch) => patchForm({ usuario: { ...form.usuario, ...patch } })}
        onChangeDireccion={(type, patch) => {
          if (type === "envio") patchForm({ envio: { ...form.envio, ...patch } as FormDireccion });
          else patchForm({ facturacion: { ...form.facturacion, ...patch } as FormDireccion });
        }}
      />

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Artículos</h2>
        {errors.Productos && <p className="text-xs text-red-500">{errors.Productos}</p>}
        <ArticleSearch onAdd={addLine} />
        <LineItemsTable lines={form.lineas} onRemove={removeLine} onUpdateCantidad={updateLineCantidad} />
      </Card>

      <TotalsPanel
        subtotal={subtotal}
        descuento={form.descuento}
        recargo={form.recargo}
        envioMonto={form.envioMonto}
        total={total}
        onChangeDescuento={(v) => patchForm({ descuento: v })}
        onChangeRecargo={(v) => patchForm({ recargo: v })}
        onChangeEnvio={(v) => patchForm({ envioMonto: v })}
      />

      <PaymentSelector
        mediosPago={mediosPago}
        loading={mediosLoading}
        loadError={mediosError}
        value={form.medioPago}
        errors={errors}
        onChange={(patch: FormMedioPago) => patchForm({ medioPago: patch })}
        onRetry={loadMediosPago}
        allowedTipos={VENTA_MEDIOS_SOPORTADOS}
      />
      <p className="-mt-2 px-1 text-xs text-muted-foreground">
        El medio de pago solo se envía en ventas directas. Las reservas se cobran luego desde Ninox.
      </p>

      <div className="space-y-3 pb-6">
        {errorList.length > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="mb-1 font-semibold">Corregí los siguientes errores antes de continuar:</p>
            <ul className="list-inside list-disc space-y-0.5 text-xs">
              {errorList.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" disabled={submitting !== null} onClick={() => void handleSubmit("preventa")}>
            {submitting === "preventa" ? "Creando reserva..." : "Crear reserva"}
          </Button>
          <Button type="button" disabled={submitting !== null} onClick={() => void handleSubmit("venta")}>
            {submitting === "venta" ? "Creando venta..." : "Crear venta directa"}
          </Button>
        </div>
      </div>
    </div>
  );
}
