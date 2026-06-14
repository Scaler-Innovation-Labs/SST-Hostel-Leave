"use client";

import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartPoint = {
  date: string;
  value: number;
};

type AnalyticsAreaChartProps = {
  data: ChartPoint[];
  title: string;
  description?: string;
  color?: string;
  height?: number;
};

export function AnalyticsAreaChart({
  data,
  title,
  description,
  color = "var(--color-primary, #6366f1)",
  height = 250,
}: AnalyticsAreaChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-1 text-base font-semibold">{title}</h3>
        {description && (
          <p className="mb-4 text-sm text-muted-foreground">{description}</p>
        )}
        <div className="flex h-[250px] items-center justify-center">
          <p className="text-sm text-muted-foreground">No data available.</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-1 text-base font-semibold">{title}</h3>
      {description && (
        <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsAreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <defs>
            <linearGradient id={`gradient-${title.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.15} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, hsl(240 5% 84%))" opacity={0.4} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground, hsl(240 4% 46%))" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
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
            labelFormatter={(label) => (typeof label === "string" ? formatDate(label) : "")}
            formatter={(value) => [typeof value === "number" ? value : 0, "Count"]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#gradient-${title.replace(/\s+/g, "-")})`}
          />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default AnalyticsAreaChart;
