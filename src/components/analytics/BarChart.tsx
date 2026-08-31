"use client";

import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART } from "@/design-system/sst";

type BarPoint = {
  name: string;
  count: number;
  color?: string | null;
};

type AnalyticsBarChartProps = {
  data: BarPoint[];
  title: string;
  description?: string;
  color?: string;
  height?: number;
};

const DEFAULT_COLORS = [CHART.accent, CHART.success, CHART.warning, CHART.danger, CHART.accent, CHART.info, CHART.danger, CHART.success];

export function AnalyticsBarChart({
  data,
  title,
  description,
  color = CHART.accent,
  height = 250,
}: AnalyticsBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-1 text-body-lg font-semibold">{title}</h3>
        {description && <p className="mb-4 text-body text-muted">{description}</p>}
        <div className="flex h-[250px] items-center justify-center">
          <p className="text-body text-muted">No data available.</p>
        </div>
      </div>
    );
  }

  const colorFor = (point: BarPoint, index: number): string => {
    const c = point.color;
    return c && /^#/.test(c) ? c : DEFAULT_COLORS[index % DEFAULT_COLORS.length]!;
  };

  const formatName = (name: string) => (name.length > 12 ? `${name.slice(0, 11)}…` : name);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-1 text-body-lg font-semibold">{title}</h3>
      {description && <p className="mb-4 text-body text-muted">{description}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} opacity={0.4} vertical={false} />
          <XAxis
            dataKey="name"
            tickFormatter={formatName}
            interval={0}
            angle={-25}
            textAnchor="end"
            tick={{ fontSize: 10, fill: CHART.axis }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: CHART.axis }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--color-border, hsl(240 5% 84%))",
              background: "rgb(var(--sst-surface))",
              fontSize: "12px",
            }}
            formatter={(value) => [typeof value === "number" ? value : 0, "Count"]}
          />
          <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((point, index) => (
              <Cell key={`${point.name}-${index}`} fill={colorFor(point, index)} />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default AnalyticsBarChart;