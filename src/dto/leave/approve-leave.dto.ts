import { z } from "zod";

import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";

export const approveLeaveSchema = z.object({
  decision: z.enum([
    LEAVE_APPROVAL_DECISION.APPROVED,
    LEAVE_APPROVAL_DECISION.REJECTED,
  ]),
  comments: z.string().optional(),
  /** Structured rejection reason category (e.g. incomplete, policy_violation). */
  rejectionCategory: z.string().trim().max(60).optional(),
  forceOverride: z.boolean().optional(),
  documentsVerified: z.boolean().optional(),
  /** Emails to CC on the notification sent to the student for this decision. */
  ccEmails: z.array(z.string().trim().email()).max(20).optional(),
});

export type ApproveLeaveDto = z.infer<typeof approveLeaveSchema>;

export default approveLeaveSchema;
