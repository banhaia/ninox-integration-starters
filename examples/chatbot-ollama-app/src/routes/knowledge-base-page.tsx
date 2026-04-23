import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getKnowledgeBase, saveKnowledgeBase, type KnowledgeBase } from "@/lib/api";

const DEFAULT_KB: KnowledgeBase = {
  nombreEmpresa: "",
  rubros: [],
  descripcionProductos: "",
  quienesSomos: "",
  ubicaciones: [],
  systemPrompt: ""
};

export function KnowledgeBasePage(): JSX.Element {
  const [form, setForm] = useState<KnowledgeBase>(DEFAULT_KB);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newRubro, setNewRubro] = useState("");
  const [newUbicacion, setNewUbicacion] = useState("");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getKnowledgeBase()
      .then((kb) => {
        setForm(kb);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  function handleChange(field: keyof KnowledgeBase, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function addRubro(): void {
    const trimmed = newRubro.trim();
    if (!trimmed) return;
    setForm((prev) => ({ ...prev, rubros: [...prev.rubros, trimmed] }));
    setNewRubro("");
  }

  function removeRubro(index: number): void {
    setForm((prev) => ({ ...prev, rubros: prev.rubros.filter((_, i) => i !== index) }));
  }

  function addUbicacion(): void {
    const trimmed = newUbicacion.trim();
    if (!trimmed) return;
    setForm((prev) => ({ ...prev, ubicaciones: [...prev.ubicaciones, trimmed] }));
    setNewUbicacion("");
  }

  function removeUbicacion(index: number): void {
    setForm((prev) => ({ ...prev, ubicaciones: prev.ubicaciones.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveKnowledgeBase(form);
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-muted-foreground">Cargando base de conocimiento...</div>;
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Base de conocimiento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Esta información se incluye en cada conversación para que el bot conozca tu empresa.
          </p>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : saved ? "¡Guardado!" : "Guardar cambios"}
        </Button>
      </div>

      <Card className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold">Stock cargado</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Revisá el catálogo sincronizado que se incorpora como contexto en el chat.
          </p>
        </div>
        <Link to="/stock">
          <Button type="button" variant="secondary">Ver stock</Button>
        </Link>
      </Card>

      {error && (
        <Card className="border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </Card>
      )}

      {/* Datos generales */}
      <Card className="space-y-4">
        <h2 className="text-base font-semibold">Datos generales</h2>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Nombre de la empresa *</label>
          <Input
            value={form.nombreEmpresa}
            onChange={(e) => handleChange("nombreEmpresa", e.target.value)}
            placeholder="Ej: ModaBA"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Rubros</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {form.rubros.map((rubro, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1 text-sm"
              >
                {rubro}
                <button type="button" onClick={() => removeRubro(i)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newRubro}
              onChange={(e) => setNewRubro(e.target.value)}
              placeholder="Ej: Indumentaria femenina"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRubro(); } }}
            />
            <Button type="button" variant="secondary" onClick={addRubro}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Quiénes somos */}
      <Card className="space-y-4">
        <h2 className="text-base font-semibold">Quiénes somos</h2>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Descripción de la empresa</label>
          <Textarea
            value={form.quienesSomos}
            onChange={(e) => handleChange("quienesSomos", e.target.value)}
            placeholder="Contá la historia y misión de tu empresa..."
            rows={4}
          />
        </div>
      </Card>

      {/* Productos */}
      <Card className="space-y-4">
        <h2 className="text-base font-semibold">Descripción de productos y servicios</h2>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Qué productos o servicios ofrecés</label>
          <Textarea
            value={form.descripcionProductos}
            onChange={(e) => handleChange("descripcionProductos", e.target.value)}
            placeholder="Describí tu catálogo, talles disponibles, rangos de precio, etc."
            rows={4}
          />
        </div>
      </Card>

      {/* Ubicaciones */}
      <Card className="space-y-4">
        <h2 className="text-base font-semibold">Ubicaciones</h2>
        <div className="space-y-2 mb-2">
          {form.ubicaciones.map((ubicacion, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl bg-secondary/50 px-3 py-2 text-sm">
              <span className="flex-1">{ubicacion}</span>
              <button type="button" onClick={() => removeUbicacion(i)} className="text-muted-foreground hover:text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newUbicacion}
            onChange={(e) => setNewUbicacion(e.target.value)}
            placeholder="Ej: Buenos Aires - Palermo: Av. Santa Fe 3500, L-V 10-20hs"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUbicacion(); } }}
          />
          <Button type="button" variant="secondary" onClick={addUbicacion}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* System prompt */}
      <Card className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">System prompt del agente</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Instrucciones de comportamiento para el bot. La información de la empresa se agrega automáticamente al final.
          </p>
        </div>
        <Textarea
          value={form.systemPrompt}
          onChange={(e) => handleChange("systemPrompt", e.target.value)}
          placeholder="Ej: Sos el asistente de [empresa]. Tu rol es ayudar con consultas sobre productos..."
          rows={8}
        />
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : saved ? "¡Guardado!" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
