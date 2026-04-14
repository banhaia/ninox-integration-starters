import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { CONDICION_IVA_OPTIONS } from "@/lib/preventa-types";
import type { FormUsuario, FormDireccion } from "@/lib/preventa-types";

interface CustomerFormProps {
  usuario: FormUsuario;
  envio: FormDireccion;
  facturacion: FormDireccion;
  errors: Record<string, string>;
  onChangeUsuario: (patch: Partial<FormUsuario>) => void;
  onChangeDireccion: (type: "envio" | "facturacion", patch: Partial<FormDireccion>) => void;
}

function DireccionBlock({
  title,
  value,
  prefix,
  errors,
  onChange
}: {
  title: string;
  value: FormDireccion;
  prefix: string;
  errors: Record<string, string>;
  onChange: (patch: Partial<FormDireccion>) => void;
}): JSX.Element {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(
          [
            { key: "Provincia", label: "Provincia" },
            { key: "Localidad", label: "Localidad" },
            { key: "Direccion", label: "Dirección" },
            { key: "CodigoPostal", label: "Código Postal" }
          ] as { key: keyof FormDireccion; label: string }[]
        ).map(({ key, label }) => {
          const errorKey = `${prefix}.${key}`;
          return (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-xs font-medium">{label}</label>
              <Input
                placeholder={label}
                value={value[key]}
                onChange={(e) => onChange({ [key]: e.target.value })}
                className={errors[errorKey] ? "border-red-400" : ""}
              />
              {errors[errorKey] && <p className="text-xs text-red-500">{errors[errorKey]}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CustomerForm({
  usuario,
  envio,
  facturacion,
  errors,
  onChangeUsuario,
  onChangeDireccion
}: CustomerFormProps): JSX.Element {
  const copyEnvioToFacturacion = (): void => {
    onChangeDireccion("facturacion", { ...envio });
  };

  return (
    <Card className="p-4 space-y-5">
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Datos del cliente
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">Nombre <span className="text-red-500">*</span></label>
            <Input
              placeholder="Nombre completo"
              value={usuario.Nombre}
              onChange={(e) => onChangeUsuario({ Nombre: e.target.value })}
              className={errors["Usuario.Nombre"] ? "border-red-400" : ""}
            />
            {errors["Usuario.Nombre"] && <p className="text-xs text-red-500">{errors["Usuario.Nombre"]}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">Email <span className="text-red-500">*</span></label>
            <Input
              type="email"
              placeholder="email@ejemplo.com"
              value={usuario.Email}
              onChange={(e) => onChangeUsuario({ Email: e.target.value })}
              className={errors["Usuario.Email"] ? "border-red-400" : ""}
            />
            {errors["Usuario.Email"] && <p className="text-xs text-red-500">{errors["Usuario.Email"]}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">DNI</label>
            <Input
              placeholder="Documento"
              value={usuario.Dni}
              onChange={(e) => onChangeUsuario({ Dni: e.target.value })}
              className={errors["Usuario.Dni"] ? "border-red-400" : ""}
            />
            {errors["Usuario.Dni"] && <p className="text-xs text-red-500">{errors["Usuario.Dni"]}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">CUIT</label>
            <Input
              placeholder="CUIT"
              value={usuario.Cuit}
              onChange={(e) => onChangeUsuario({ Cuit: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">Teléfono</label>
            <Input
              placeholder="Teléfono"
              value={usuario.Telefono}
              onChange={(e) => onChangeUsuario({ Telefono: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">Condición IVA</label>
            <Select
              value={String(usuario.Condicion)}
              onChange={(e) => onChangeUsuario({ Condicion: Number(e.target.value) })}
            >
              {CONDICION_IVA_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <DireccionBlock
          title="Dirección de envío"
          value={envio}
          prefix="DireccionEnvio"
          errors={errors}
          onChange={(patch) => onChangeDireccion("envio", patch)}
        />
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dirección de facturación
            </p>
            <Button
              type="button"
              variant="ghost"
              className="h-auto py-0.5 px-2 text-xs"
              onClick={copyEnvioToFacturacion}
            >
              Copiar desde envío
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(
              [
                { key: "Provincia", label: "Provincia" },
                { key: "Localidad", label: "Localidad" },
                { key: "Direccion", label: "Dirección" },
                { key: "CodigoPostal", label: "Código Postal" }
              ] as { key: keyof FormDireccion; label: string }[]
            ).map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs font-medium">{label}</label>
                <Input
                  placeholder={label}
                  value={facturacion[key]}
                  onChange={(e) => onChangeDireccion("facturacion", { [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
