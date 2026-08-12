import { z } from "zod";

export const analyticsPeriodSchema = z.enum(["7d", "30d", "90d", "all"]);
export type AnalyticsPeriod = z.infer<typeof analyticsPeriodSchema>;

export const breakdownItemSchema = z.object({
  name: z.string(),
  count: z.number(),
});

export const trendItemSchema = z.object({
  date: z.string(),
  value: z.number(),
});

export type BreakdownItem = z.infer<typeof breakdownItemSchema>;
export type TrendItem = z.infer<typeof trendItemSchema>;

export const ANALYTICS_PERIOD_OPTIONS: Array<{ value: AnalyticsPeriod; label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];