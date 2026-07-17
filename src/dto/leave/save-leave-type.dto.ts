import { z } from "zod";

import { LEAVE_CATEGORIES } from "@/constants/leave/leave-category";
import { QR_MODES } from "@/constants/leave/qr-mode";
import { LEAVE_WORKFLOW_MODES } from "@/constants/leave/workflow-mode";

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

const requiredDocumentSchema = z.object({
  code: z.string().min(1).max(50),
  label: z.string().min(1).max(200),
  required: z.boolean(),
  acceptedTypes: z.array(z.string().max(20)).optional(),
});

const leaveTypeBaseSchema = z.object({
  code: z.string().min(2).max(50).transform((v) => v.toUpperCase().replace(/\s+/g, "_")),
  name: z.string().min(2).max(200),
  category: z.enum(LEAVE_CATEGORIES),
  description: z.string().max(1000).optional().nullable(),
  workflowMode: z.enum(LEAVE_WORKFLOW_MODES),
  qrMode: z.enum(QR_MODES).optional().default("BOTH"),
  defaultWorkflowId: z.string().uuid().optional().nullable(),
  allowExtensions: z.boolean().default(false),
  maxExtensionCount: z.number().int().min(0).max(100).optional().nullable(),
  isActive: z.boolean().default(true),
  formSchema: z.object({
    fields: z.array(formFieldSchema).min(1, "At least one form field is required"),
  }),
  requiredDocuments: z.array(requiredDocumentSchema).optional().nullable(),
  notificationConfig: z.record(z.string(), z.unknown()).optional().nullable(),
  uiConfig: z.record(z.string(), z.unknown()).optional().nullable(),
  useGlobalNotificationRules: z.boolean().optional().default(true),
  policyConfig: z.record(z.string(), z.unknown()).optional().nullable().default({}),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const createLeaveTypeSchema = leaveTypeBaseSchema.refine(
  (data) => !data.allowExtensions || (data.maxExtensionCount != null && data.maxExtensionCount > 0),
  { message: "maxExtensionCount is required when extensions are allowed", path: ["maxExtensionCount"] },
);

export const saveLeaveTypeSchema = leaveTypeBaseSchema;

export type CreateLeaveTypeDto = z.infer<typeof createLeaveTypeSchema>;
export type SaveLeaveTypeDto = z.infer<typeof saveLeaveTypeSchema>;
export default saveLeaveTypeSchema;
