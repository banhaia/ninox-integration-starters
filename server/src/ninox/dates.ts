/**
 * La API de Ninox serializa DateTime como "dd/MM/yyyy HH:mm:ss" en UTC.
 * Se acepta además ISO 8601 por robustez (algunos campos o entornos pueden variar).
 */
const NINOX_DATE = /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

export function parseNinoxDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();

  const match = NINOX_DATE.exec(raw);
  if (match) {
    const [, dd, mm, yyyy, hh = "0", mi = "0", ss = "0"] = match;
    const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss)));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

export function toIsoOrNull(value: unknown): string | null {
  return parseNinoxDate(value)?.toISOString() ?? null;
}

/** "YYYY-MM" a partir de año y mes (1-12). */
export function periodo(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

/** Lista de períodos "YYYY-MM" entre dos períodos inclusive. */
export function periodRange(desde: string, hasta: string): string[] {
  const parse = (value: string): [number, number] => {
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    if (!match) throw new Error(`Período inválido: ${value}`);
    const mes = Number(match[2]);
    if (mes < 1 || mes > 12) throw new Error(`Período inválido: ${value}`);
    return [Number(match[1]), mes];
  };

  let [anio, mes] = parse(desde);
  const [anioHasta, mesHasta] = parse(hasta);
  const result: string[] = [];

  while (anio < anioHasta || (anio === anioHasta && mes <= mesHasta)) {
    result.push(periodo(anio, mes));
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
    if (result.length > 120) throw new Error("El rango no puede superar 120 meses");
  }

  return result;
}

export function shiftPeriod(value: string, months: number): string {
  const [anio, mes] = value.split("-").map(Number);
  const index = anio * 12 + (mes - 1) + months;
  return periodo(Math.floor(index / 12), (index % 12) + 1);
}
