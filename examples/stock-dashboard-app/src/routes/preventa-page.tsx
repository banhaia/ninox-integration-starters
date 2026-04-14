import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { getMediosPago, createPreventa, createVenta } from "@/lib/api";
import type { MediosPagoPayload, PreventaSubmitPayload } from "@/lib/api";
import {
  INITIAL_FORM_STATE,
  type FormLinea,
  type FormDireccion,
  type FormMedioPago,
  type PreventaFormState
} from "@/lib/preventa-types";

const DRAFT_KEY = "ninox-preventa-draft";

type SubmitType = "preventa" | "venta";

interface SubmitResult {
  type: SubmitType;
  success: boolean;
  message: string;
}

function validateForm(
  state: PreventaFormState,
  subtotal: number,
  total: number
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!state.ordenId.trim()) errors.OrdenId = "OrdenId es requerido";
  if (!state.numero.trim()) errors.Numero = "Número es requerido";

  if (!state.usuario.Nombre.trim()) errors["Usuario.Nombre"] = "Nombre es requerido";
  if (!state.usuario.Email.trim()) {
    errors["Usuario.Email"] = "Email es requerido";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.usuario.Email)) {
    errors["Usuario.Email"] = "Email inválido";
  }
  if (!state.usuario.Dni.trim() && !state.usuario.Cuit.trim()) {
    errors["Usuario.Dni"] = "DNI o CUIT es requerido";
  }

  if (state.lineas.length === 0) {
    errors.Productos = "Debe agregar al menos un artículo";
  }

  void subtotal;
  if (total <= 0) {
    errors.Total = "El total debe ser mayor a 0";
  }

  return errors;
}

function buildPayload(state: PreventaFormState, subtotal: number, total: number): PreventaSubmitPayload {
  return {
    ordenId: Number(state.ordenId),
    numero: Number(state.numero),
    detalle: state.detalle || undefined,
    direccionEnvio: {
      provincia: state.envio.Provincia,
      localidad: state.envio.Localidad,
      direccion: state.envio.Direccion,
      codigoPostal: state.envio.CodigoPostal
    },
    direccionFacturacion: {
      provincia: state.facturacion.Provincia,
      localidad: state.facturacion.Localidad,
      direccion: state.facturacion.Direccion,
      codigoPostal: state.facturacion.CodigoPostal
    },
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
    total
  };
}

export function PreventaPage(): JSX.Element {
  const [form, setForm] = useState<PreventaFormState>({ ...INITIAL_FORM_STATE });
  const [mediosPago, setMediosPago] = useState<MediosPagoPayload | null>(null);
  const [mediosLoading, setMediosLoading] = useState(true);
  const [mediosError, setMediosError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<SubmitType | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasDraft, setHasDraft] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMediosPago = useCallback(() => {
    let cancelled = false;
    setMediosLoading(true);
    setMediosError(null);
    getMediosPago()
      .then((data) => { if (!cancelled) setMediosPago(data); })
      .catch((err: Error) => { if (!cancelled) setMediosError(err.message ?? "Error al cargar medios de pago"); })
      .finally(() => { if (!cancelled) setMediosLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const cleanup = loadMediosPago();
    setHasDraft(Boolean(localStorage.getItem(DRAFT_KEY)));
    return cleanup;
  }, [loadMediosPago]);

  const subtotal = useMemo(
    () => form.lineas.reduce((sum, l) => sum + l.precio * l.cantidad, 0),
    [form.lineas]
  );

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
    setForm((prev) => ({
      ...prev,
      lineas: prev.lineas.map((l, i) => (i === index ? { ...l, cantidad } : l))
    }));
  }

  // ── Draft ──────────────────────────────────────────────────────────────────

  function saveDraft(): void {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    setHasDraft(true);
  }

  function loadDraft(): void {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as PreventaFormState;
      setForm(parsed);
      setErrors({});
    } catch {
      // ignore corrupt draft
    }
  }

  function downloadDraft(): void {
    const blob = new Blob([JSON.stringify(form, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `borrador-preventa-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as PreventaFormState;
        setForm(parsed);
        setErrors({});
      } catch {
        // ignore invalid file
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(type: SubmitType): Promise<void> {
    const validationErrors = validateForm(form, subtotal, total);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(type);
    setSubmitResult(null);
    try {
      const payload = buildPayload(form, subtotal, total);
      const result = type === "preventa"
        ? await createPreventa(payload)
        : await createVenta(payload);

      // Our backend errors (validation / proxy)
      if (result.error || result.errors) {
        const msg = result.error ?? JSON.stringify(result.errors, null, 2);
        setSubmitResult({ type, success: false, message: msg });
        return;
      }

      // Ninox considera exitoso solo cuando facturaId > 0
      // datos es Record<string,string> — concatenar todos los valores como mensaje de error
      const ninoxError = result.datos && Object.keys(result.datos).length > 0
        ? Object.values(result.datos).join(" | ")
        : undefined;
      if (!result.facturaId || result.facturaId === 0) {
        const msg = ninoxError ?? "Ninox no devolvió un facturaId válido. Revisá los datos e intentá de nuevo.";
        setSubmitResult({ type, success: false, message: msg });
        return;
      }

      setSubmitResult({
        type,
        success: true,
        message: `${type === "preventa" ? "Preventa" : "Venta"} creada. ID: ${result.facturaId}${result.sref ? ` · Ref: ${result.sref}` : ""}`
      });
      localStorage.removeItem(DRAFT_KEY);
      setHasDraft(false);
      setForm({ ...INITIAL_FORM_STATE });
      setErrors({});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setSubmitResult({ type, success: false, message });
    } finally {
      setSubmitting(null);
    }
  }

  const errorList = Object.entries(errors).map(([, msg]) => msg);

  return (
    <div className="space-y-4">
      {/* Page header */}
      <Card className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Preventas / Ventas</h1>
            <p className="text-sm text-muted-foreground">
              Creá una preventa o venta directa contra Ninox ERP
            </p>
          </div>
        </div>

        {/* Draft actions */}
        <div className="flex items-center gap-2">
          {hasDraft && (
            <Button
              type="button"
              variant="ghost"
              className="h-8 gap-1.5 px-3 text-xs"
              onClick={loadDraft}
              title="Cargar borrador guardado"
            >
              <BookMarked className="h-3.5 w-3.5" />
              Cargar borrador
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            className="h-8 gap-1.5 px-3 text-xs"
            onClick={saveDraft}
            title="Guardar borrador en este navegador"
          >
            <BookMarked className="h-3.5 w-3.5" />
            Guardar borrador
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-8 gap-1.5 px-3 text-xs"
            onClick={downloadDraft}
            title="Descargar borrador como JSON"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar JSON
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-8 gap-1.5 px-3 text-xs"
            onClick={() => fileInputRef.current?.click()}
            title="Importar borrador desde JSON"
          >
            <Upload className="h-3.5 w-3.5" />
            Importar JSON
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </Card>

      {submitResult && (
        <ResultBanner
          type={submitResult.success ? "success" : "error"}
          message={submitResult.message}
          onDismiss={() => setSubmitResult(null)}
        />
      )}

      <OrderHeader
        ordenId={form.ordenId}
        numero={form.numero}
        detalle={form.detalle}
        errors={errors}
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

      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Artículos
        </h2>
        {errors.Productos && (
          <p className="text-xs text-red-500">{errors.Productos}</p>
        )}
        <ArticleSearch onAdd={addLine} />
        <LineItemsTable
          lines={form.lineas}
          onRemove={removeLine}
          onUpdateCantidad={updateLineCantidad}
        />
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
      />

      {/* Validation summary + action buttons */}
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

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={submitting !== null}
            onClick={() => void handleSubmit("preventa")}
          >
            {submitting === "preventa" ? "Creando preventa..." : "Crear Preventa"}
          </Button>
          <Button
            type="button"
            disabled={submitting !== null}
            onClick={() => void handleSubmit("venta")}
          >
            {submitting === "venta" ? "Creando venta..." : "Crear Venta Directa"}
          </Button>
        </div>
      </div>
    </div>
  );
}
