# Reportes

## Propósito

Módulo interno que calcula indicadores **solo con la base local** (lo ingestado). Nunca llama a Ninox, así que se puede reutilizar desde otras piezas sin consumir rate limit: un chatbot, exportaciones o alertas programadas.

## Código

| Archivo | Responsabilidad |
|---|---|
| `server/src/modules/reports/service.ts` | Funciones puras sobre `db`: `getMonthly`, `getTopProducts`, `getPaymentMethods`, `getCoverage`, `getSucursales` |
| `server/src/modules/reports/routes.ts` | `/reports/*` |
| `src/routes/reports-page.tsx` | KPIs, gráficos (Recharts, carga diferida) y tabla |
| `src/components/charts/chart-theme.ts` | Paleta y estilos de gráficos |

## Indicadores mensuales (`getMonthly`)

| Campo | Fuente | Cálculo |
|---|---|---|
| `ventasBrutas` | `ventas_totales` | Σ \|total\| de facturas (tipo ≠ 4) |
| `notasCredito` | `ventas_totales` | Σ \|total\| de NC (tipo 4) |
| `ventasNetas` | | brutas − NC |
| `comprobantes`, `ticketPromedio` | `ventas_totales` | cantidad de facturas; brutas / cantidad |
| `unidades` | `ventas_items` | Σ cantidad (las NC restan) |
| `ventasItems`, `costo`, `margenBruto`, `margenPorcentaje` | `ventas_items` | Σ cantidad × `precio_venta_final`; Σ cantidad × `costo_item`; diferencia y % |
| `comprasNetas`, `comprobantesCompra` | `compras_totales` | Σ \|total\| (las NC de tipo 3 restan); cantidad de facturas |

- **Signo:** se usa `ABS()` sobre los importes y el signo lo define el tipo de comprobante, para no depender de cómo exporte Ninox el signo de las NC.
- **Agrupación:** los meses se agrupan por `periodo`, que es el mes del job que importó la fila, e incluyen los meses sin datos en cero.
- **Margen estimado:** sale de los ítems, a precio final. `ventasNetas` sale de los totales de comprobante, que incluyen impuestos y ajustes de cabecera. Por eso pueden diferir.

## Gráficos

- **Ventas contra compras** (barras agrupadas):
  - Un solo eje en pesos.
  - Colores fijos por entidad: azul para ventas, naranja para compras. Paleta validada para daltonismo.
- **Ticket promedio** (línea de 2 px).
- **Top 10 artículos y medios de pago** (barras horizontales de un solo color).
- **Tabla** con el detalle mensual como alternativa accesible a los gráficos.

## Extender

1. Agregar una función en `service.ts` que reciba `db` y los filtros, y devuelva datos planos.
2. Exponerla en `routes.ts`, tiparla en `src/lib/api.ts` y graficarla reutilizando `chart-theme.ts`.
3. Sumar un caso en `tests/ingest-reports.test.ts`.

**Ideas:** ventas por vendedor (`ventas_totales.vendedor`), por día de la semana (`fecha_text`), rotación de stock (cruce `ventas_items.codigo` ↔ `articulos.codigo`) o comparativa entre sucursales.
