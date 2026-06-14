import { z } from "zod";

const LEAVE_FORM_FIELD_TYPES = ["text", "textarea", "tel", "email", "number", "select", "checkbox", "date"] as const;

const formFieldSchema = z.object({
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  type: z.enum(LEAVE_FORM_FIELD_TYPES),
  required: z.boolean().optional().default(false),
  placeholder: z.string().max(200).optional(),
  options: z.array(z.string().max(100)).optional(),
  minLength: z.number().int().min(0).max(10000).optional(),
  maxLength: z.number().int().min(0).max(10000).optional(),
});

const LEAVE_CATEGORIES = ["HOME_PASS", "MEDICAL", "LOCAL_OUTING", "NIGHT_OUT"] as const;
const WORKFLOW_MODES = ["HOSTEL", "ACADEMIC"] as const;

export const saveLeaveTypeSchema = z.object({
  code: z.string().min(2).max(50).transform((v) => v.toUpperCase().replace(/\s+/g, "_")),
  name: z.string().min(2).max(200),
  category: z.enum(LEAVE_CATEGORIES),
  description: z.string().max(1000).optional().nullable(),
  workflowMode: z.enum(WORKFLOW_MODES),
  defaultWorkflowId: z.string().uuid().optional().nullable(),
  allowExtensions: z.boolean().default(false),
  maxExtensionCount: z.number().int().min(0).max(100).optional().nullable(),
  isActive: z.boolean().default(true),
  formSchema: z.object({
    fields: z.array(formFieldSchema).min(1, "At least one form field is required"),
  }),
  policyConfig: z.record(z.string(), z.unknown()).optional().nullable().default({}),
}).refine(
  (data) => !data.allowExtensions || (data.maxExtensionCount != null && data.maxExtensionCount > 0),
  { message: "maxExtensionCount is required when extensions are allowed", path: ["maxExtensionCount"] },
);

export type SaveLeaveTypeDto = z.infer<typeof saveLeaveTypeSchema>;
export default saveLeaveTypeSchema;
