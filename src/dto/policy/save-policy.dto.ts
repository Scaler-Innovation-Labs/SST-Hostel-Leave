import { z } from "zod";

export const POLICY_TYPES = [
  "MAX_DAYS",
  "BLOCK_DURING_PERIOD",
  "RESTRICT_BATCH",
  "REQUIRE_PARENT_APPROVAL",
  "CURFEW_RESTRICTION",
  "MAX_EXTENSION_COUNT",
  "FORM_FIELD_RESTRICTION",
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
  const requiredConfig: Partial<Record<(typeof POLICY_TYPES)[number], string>> = {
    MAX_DAYS: "maxDays",
    BLOCK_DURING_PERIOD: "blockedPeriods",
    RESTRICT_BATCH: "blockedBatchYears",
    CURFEW_RESTRICTION: "latestReturnTime",
    MAX_EXTENSION_COUNT: "maxExtensionCount",
  };
  const key = requiredConfig[value.policyType];
  if (key && value.config[key] === undefined) {
    context.addIssue({ code: "custom", path: ["config", key], message: `${key} is required` });
  }
  if (value.startsAt && value.endsAt && new Date(value.startsAt) >= new Date(value.endsAt)) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "endsAt must be after startsAt" });
  }
});

export type SavePolicyDto = z.infer<typeof savePolicySchema>;

export default savePolicySchema;
