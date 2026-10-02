/**
 * Tokens de gráficos. Paleta categórica validada (orden fijo, nunca ciclado):
 * slot 1 = ventas, slot 2 = compras. Series simples usan siempre el slot 1.
 * El color sigue a la entidad: "Ventas" es azul en todos los gráficos.
 */
export const chartColors = {
  series1: "#2a78d6",
  series2: "#eb6834",
  grid: "hsl(40 22% 86%)",
  axis: "hsl(158 10% 35%)",
  textPrimary: "hsl(160 18% 14%)",
  textSecondary: "hsl(158 10% 35%)"
} as const;

export const axisProps = {
  stroke: chartColors.grid,
  tick: { fill: chartColors.axis, fontSize: 12 },
  tickLine: false,
  axisLine: false
} as const;

/** Extremo redondeado de 4px solo en el lado de los datos. */
export const BAR_RADIUS_VERTICAL: [number, number, number, number] = [4, 4, 0, 0];
export const BAR_RADIUS_HORIZONTAL: [number, number, number, number] = [0, 4, 4, 0];

export const tooltipStyle = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid hsl(40 22% 82%)",
    boxShadow: "0 12px 30px -18px rgba(20, 32, 29, 0.4)",
    fontSize: 12,
    color: chartColors.textPrimary
  },
  labelStyle: { color: chartColors.textPrimary, fontWeight: 600 },
  itemStyle: { color: chartColors.textSecondary }
} as const;
