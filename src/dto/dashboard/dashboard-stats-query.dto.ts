import { z } from "zod";

import { LEAVE_REQUEST_STATUSES } from "@/constants/leave/leave-status";
import { analyticsPeriodSchema } from "@/dto/analytics/analytics-period.dto";

export const dashboardStatsQuerySchema = z.object({
  status: z.enum(LEAVE_REQUEST_STATUSES).optional(),
  period: analyticsPeriodSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type DashboardStatsQuery = z.infer<typeof dashboardStatsQuerySchema>;
