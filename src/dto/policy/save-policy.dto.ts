import { z } from "zod";

export const POLICY_TYPES = [
  "FORM_VALIDATION",
  "ELIGIBILITY",
  "LIMIT",
  "WORKFLOW",
  "DOCUMENT_REQUIREMENT",
  "QR_RULE",
  "TIME_WINDOW",
  "FEATURE_FLAG",
] as const;

export const savePolicySchema = z.object({
  name: z.string().trim().min(2).max(200),
  policyType: z.enum(POLICY_TYPES),
  priority: z.number().int().min(0).max(10000).default(0),
  leaveTypeId: z.string().uuid().nullable().optional(),
  hostelId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  batchYear: z.coerce.number().int().min(1900).max(2100).nullable().optional(),
  config: z.record(z.string(), z.unknown()),
  isActive: z.boolean().default(true),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
}).superRefine((value, context) => {
  if (value.policyType === "TIME_WINDOW" && value.config.type === "BLOCKED_PERIOD") {
    if (value.config.blockedPeriods === undefined) {
      context.addIssue({ code: "custom", path: ["config", "blockedPeriods"], message: "blockedPeriods is required for BLOCKED_PERIOD" });
    }
  }
  if (value.startsAt && value.endsAt && new Date(value.startsAt) >= new Date(value.endsAt)) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "endsAt must be after startsAt" });
  }
});

export type SavePolicyDto = z.infer<typeof savePolicySchema>;

export default savePolicySchema;
