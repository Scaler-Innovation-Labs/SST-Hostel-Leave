import { ValidationError } from "@/lib/errors";
import { parseLeaveFormSchema } from "@/lib/leave-form-schema";

export function validateLeaveSubmittedForm(schemaValue: unknown, submittedForm: Record<string, unknown> | undefined): Record<string, unknown> {
  const schema = parseLeaveFormSchema(schemaValue);
  const submitted = submittedForm ?? {};
  const allowedKeys = new Set(schema.fields.map((field) => field.key));
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(submitted)) {
    if (!allowedKeys.has(key)) throw new ValidationError(`Unknown leave form field: ${key}`);
  }

  for (const field of schema.fields) {
    const value = submitted[field.key];
    const isEmpty = value === undefined || value === null || value === "";
    if (field.required && isEmpty) throw new ValidationError(`${field.label} is required`);
    if (isEmpty) continue;
    if (field.type === "checkbox") {
      if (typeof value !== "boolean") throw new ValidationError(`${field.label} must be true or false`);
    } else if (field.type === "number") {
      if (typeof value !== "number" && (typeof value !== "string" || Number.isNaN(Number(value)))) throw new ValidationError(`${field.label} must be a number`);
    } else if (typeof value !== "string") {
      throw new ValidationError(`${field.label} must be text`);
    }
    if (typeof value === "string" && field.minLength && value.length < field.minLength) throw new ValidationError(`${field.label} must be at least ${field.minLength} characters`);
    if (typeof value === "string" && field.maxLength && value.length > field.maxLength) throw new ValidationError(`${field.label} must be at most ${field.maxLength} characters`);
    if (field.options?.length && !field.options.includes(String(value))) throw new ValidationError(`${field.label} has an invalid value`);
    result[field.key] = field.type === "number" ? Number(value) : value;
  }
  return result;
}
