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

const DEFAULT_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export function AnalyticsBarChart({
  data,
  title,
  description,
  color = "#6366f1",
  height = 250,
}: AnalyticsBarChartProps) {
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

  const colorFor = (point: BarPoint, index: number): string => {
    const c = point.color;
    return c && /^#/.test(c) ? c : DEFAULT_COLORS[index % DEFAULT_COLORS.length]!;
  };

  const formatName = (name: string) => (name.length > 12 ? `${name.slice(0, 11)}…` : name);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-1 text-base font-semibold">{title}</h3>
      {description && <p className="mb-4 text-sm text-muted-foreground">{description}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, hsl(240 5% 84%))" opacity={0.4} vertical={false} />
          <XAxis
            dataKey="name"
            tickFormatter={formatName}
            interval={0}
            angle={-25}
            textAnchor="end"
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