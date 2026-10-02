const currency = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const currencyCents = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
const number = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 });

export const formatMoney = (value: number): string => currency.format(value);
export const formatMoneyCents = (value: number): string => currencyCents.format(value);
export const formatNumber = (value: number): string => number.format(value);
export const formatCompact = (value: number): string => compact.format(value);

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-03" → "mar 2026" */
export function formatPeriodo(periodo: string, withYear = true): string {
  const [anio, mes] = periodo.split("-").map(Number);
  const name = MONTHS[mes - 1] ?? periodo;
  return withYear ? `${name} ${anio}` : name;
}

export function currentPeriodo(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftPeriodo(periodo: string, months: number): string {
  const [anio, mes] = periodo.split("-").map(Number);
  const index = anio * 12 + (mes - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}
