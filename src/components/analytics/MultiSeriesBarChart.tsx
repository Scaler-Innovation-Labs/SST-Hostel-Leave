"use client";

import { Bar, BarChart as RechartsBarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type SeriesDef = {
  key: string;
  label: string;
  color: string;
};

type MultiSeriesBarChartProps = {
  data: Array<Record<string, string | number>>;
  series: SeriesDef[];
  title: string;
  description?: string;
  height?: number;
  dateKey?: string;
  stacked?: boolean;
};

const formatShortDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export function MultiSeriesBarChart({
  data,
  series,
  title,
  description,
  height = 250,
  dateKey = "date",
  stacked = false,
}: MultiSeriesBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-1 text-base font-semibold">{title}</h3>
        {description && <p className="mb-4 text-sm text-muted-foreground">{description}</p>}
        <div className="flex h-[250px] items-center justify-center">
          <p className="text-sm text-muted-foreground">No data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-1 text-base font-semibold">{title}</h3>
      {description && <p className="mb-4 text-sm text-muted-foreground">{description}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.4} vertical={false} />
          <XAxis
            dataKey={dateKey}
            tickFormatter={(v: string) => formatShortDate(v)}
            interval="preserveStartEnd"
            minTickGap={24}
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground, hsl(240 4% 46%))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground, hsl(240 4% 46%))" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--color-border, hsl(240 5% 84%))",
              background: "var(--color-card, hsl(0 0% 100%))",
              fontSize: "12px",
            }}
            labelFormatter={(label) => (label ? formatShortDate(String(label)) : String(label))}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId={stacked ? "stack" : undefined}
              fill={s.color}
              maxBarSize={stacked ? 18 : 28}
              radius={4}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default MultiSeriesBarChart;