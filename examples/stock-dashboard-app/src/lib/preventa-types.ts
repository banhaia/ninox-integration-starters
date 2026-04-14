export const CONDICION_IVA: Record<string, number> = {
  "Sin categoría": 0,
  "Consumidor Final": 1,
  "Responsable Inscripto": 2,
  "Monotributo": 3,
  "Exento": 4,
  "Responsable No Inscripto": 5
};

export const CONDICION_IVA_OPTIONS = Object.entries(CONDICION_IVA).map(([label, value]) => ({
  label,
  value
}));

export const TIPO_MEDIO = {
  EFECTIVO: 1,
  TARJETA: 5,
  CUENTA_CORRIENTE: 6,
  DEPOSITO_BANCO: 9,
  VIRTUAL: 11
} as const;

export const TIPO_MEDIO_LABELS: Record<number, string> = {
  1: "Efectivo",
  5: "Tarjeta",
  6: "Cta. Corriente",
  9: "Transferencia",
  11: "Virtual"
};

export interface FormDireccion {
  Provincia: string;
  Localidad: string;
  Direccion: string;
  CodigoPostal: string;
}

export interface FormUsuario {
  Nombre: string;
  Email: string;
  Dni: string;
  Cuit: string;
  Telefono: string;
  Condicion: number;
}

export interface FormLinea {
  articleId: number;
  articleCode: string;
  articleName: string;
  precio: number;
  cantidad: number;
  talleId?: number;
  colorId?: number;
  talleLabel?: string;
  colorLabel?: string;
  /** True when articleId could not be parsed from the catalog code */
  idWarning?: boolean;
}

export interface FormMedioPago {
  tipo: number | null;
  tarjetaId?: number;
  cuentaBancariaId?: number;
  externalId?: string;
}

export interface PreventaFormState {
  ordenId: string;
  numero: string;
  detalle: string;
  usuario: FormUsuario;
  envio: FormDireccion;
  facturacion: FormDireccion;
  lineas: FormLinea[];
  descuento: number;
  recargo: number;
  envioMonto: number;
  medioPago: FormMedioPago;
}

export const EMPTY_DIRECCION: FormDireccion = {
  Provincia: "",
  Localidad: "",
  Direccion: "",
  CodigoPostal: ""
};

export const EMPTY_USUARIO: FormUsuario = {
  Nombre: "",
  Email: "",
  Dni: "",
  Cuit: "",
  Telefono: "",
  Condicion: 1
};

export const INITIAL_FORM_STATE: PreventaFormState = {
  ordenId: "",
  numero: "",
  detalle: "",
  usuario: { ...EMPTY_USUARIO },
  envio: { ...EMPTY_DIRECCION },
  facturacion: { ...EMPTY_DIRECCION },
  lineas: [],
  descuento: 0,
  recargo: 0,
  envioMonto: 0,
  medioPago: { tipo: null }
};
