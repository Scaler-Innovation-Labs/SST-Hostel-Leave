"use client";

import { Cell, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

type LeaveTypePieChartProps = {
  data: Array<{ name: string; count: number }>;
  title: string;
};

export function LeaveTypePieChart({ data, title }: LeaveTypePieChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold">{title}</h3>
        <div className="flex h-[250px] items-center justify-center">
          <p className="text-sm text-muted-foreground">No data available.</p>
        </div>
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-4 text-base font-semibold">{title}</h3>
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="shrink-0">
          <ResponsiveContainer width={180} height={180}>
            <RechartsPieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={2}
                dataKey="count"
                nameKey="name"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={COLORS[index % COLORS.length]}
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid var(--color-border, hsl(240 5% 84%))",
                  background: "var(--color-card, hsl(0 0% 100%))",
                  fontSize: "12px",
                }}
                formatter={(value, name) => [typeof value === "number" ? value : 0, name]}
              />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {data.map((item, index) => (
            <div key={item.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-muted-foreground">{item.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium tabular-nums">{item.count}</span>
                <span className="w-10 text-right text-xs text-muted-foreground">
                  {total > 0 ? Math.round((item.count / total) * 100) : 0}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default LeaveTypePieChart;
