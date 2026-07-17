import { z } from "zod";

import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";

export const approveLeaveSchema = z.object({
  decision: z.enum([
    LEAVE_APPROVAL_DECISION.APPROVED,
    LEAVE_APPROVAL_DECISION.REJECTED,
  ]),
  comments: z.string().optional(),
  forceOverride: z.boolean().optional(),
  documentsVerified: z.boolean().optional(),
});

export type ApproveLeaveDto = z.infer<typeof approveLeaveSchema>;

export default approveLeaveSchema;
