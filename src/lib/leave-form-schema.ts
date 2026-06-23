import { z } from "zod";

import { LEAVE_FORM_FIELD_TYPES, type LeaveFormField, type LeaveFormSchema } from "@/types/leave/leave-form-schema";

const leaveFormFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(LEAVE_FORM_FIELD_TYPES),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
});

function normalizeField(value: unknown): LeaveFormField | null {
  if (typeof value === "string") {
    return {
      key: value,
      label: value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()),
      type: "text",
      required: true,
    };
  }
  if (!value || typeof value !== "object") return null;
  const result = leaveFormFieldSchema.safeParse(value);
  if (!result.success) return null;
  return result.data;
}

export function parseLeaveFormSchema(value: unknown): LeaveFormSchema {
  if (!value || typeof value !== "object") return { fields: [] };
  const fields = (value as Record<string, unknown>).fields;
  if (!Array.isArray(fields)) return { fields: [] };
  return { fields: fields.map(normalizeField).filter((field): field is LeaveFormField => field !== null) };
}
