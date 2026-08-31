/**
 * The chart palette.
 *
 * Recharts needs a concrete colour string, not a Tailwind class, so these read
 * the tokens as CSS custom properties. They resolve per theme like everything
 * else — a chart drawn in light mode and the same chart in dark are the same
 * chart, not two hardcoded pictures.
 *
 * One or two colours per chart, never a rainbow. `SERIES` is ordered so the
 * first two carry almost every chart; the rest exist only for a genuinely
 * categorical breakdown, and a series must still be distinguishable without
 * colour — direct labels or dash patterns, never a colour-only legend.
 */
const token = (name: string) => `rgb(var(--sst-${name}))`;

export const CHART = {
  accent: token("accent"),
  info: token("info"),
  success: token("success"),
  warning: token("warning"),
  danger: token("danger"),
  muted: token("text-muted"),
  /** Axes, gridlines and other non-data furniture. */
  grid: `rgb(var(--sst-border))`,
  axis: token("text-muted"),
} as const;

/** The default ordering for a multi-series chart. */
export const CHART_SERIES = [
  CHART.accent,
  CHART.info,
  CHART.success,
  CHART.warning,
  CHART.danger,
  CHART.muted,
] as const;

/** Shared axis and tick styling, so every chart's furniture matches. */
export const CHART_AXIS = {
  stroke: CHART.axis,
  fontSize: 12,
} as const;
