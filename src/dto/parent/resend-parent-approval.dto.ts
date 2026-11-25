import { z } from "zod";

export const resendParentApprovalSchema = z.object({
  parentId: z.string().uuid("Invalid parent ID").optional(),
});

export type ResendParentApprovalDto = z.infer<typeof resendParentApprovalSchema>;
