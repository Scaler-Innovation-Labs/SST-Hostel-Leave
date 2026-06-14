import { z } from "zod";

import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";

export const parentDecisionSchema = z.object({
  decision: z.enum([
    LEAVE_APPROVAL_DECISION.APPROVED,
    LEAVE_APPROVAL_DECISION.REJECTED,
  ]),
  comments: z.string().max(500).optional(),
});

export type ParentDecisionDto = z.infer<typeof parentDecisionSchema>;

export default parentDecisionSchema;
