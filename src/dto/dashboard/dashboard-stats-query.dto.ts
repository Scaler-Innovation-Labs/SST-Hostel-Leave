import { z } from "zod";

import { LEAVE_REQUEST_STATUSES } from "@/constants/leave/leave-status";

export const dashboardStatsQuerySchema = z.object({
  status: z.enum(LEAVE_REQUEST_STATUSES).optional(),
});

export type DashboardStatsQuery = z.infer<typeof dashboardStatsQuerySchema>;
