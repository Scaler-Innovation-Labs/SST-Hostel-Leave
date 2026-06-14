import { z } from "zod";

const workflowStepSchema = z
  .object({
    stepKey: z.string().trim().min(2).max(100).regex(/^[A-Z0-9_]+$/),
    approverRoleCode: z.string().trim().min(2).max(100).nullable().optional(),
    isParentApproval: z.boolean().default(false),
    approvalMethod: z
      .enum(["SMS_REPLY", "SMS_AND_LINK", "SMS_LINK", "PORTAL", "AUTO"])
      .nullable()
      .optional(),
    isRequired: z.boolean().default(true),
  })
  .refine((step) => step.isParentApproval || Boolean(step.approverRoleCode), {
    message: "Each step requires an approver role or parent approval",
  });

export const saveWorkflowSchema = z.object({
  code: z.string().trim().min(2).max(100).regex(/^[A-Z0-9_]+$/),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  isActive: z.boolean().default(true),
  steps: z.array(workflowStepSchema).min(1).max(20),
});

export type SaveWorkflowDto = z.infer<typeof saveWorkflowSchema>;

export default saveWorkflowSchema;
