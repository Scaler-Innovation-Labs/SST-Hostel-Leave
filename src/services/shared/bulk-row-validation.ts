import { ValidationError } from "@/lib/errors";
import {
  INDIAN_MOBILE_PATTERN,
  normalizePhoneNumber,
  PHONE_VALIDATION_MESSAGE,
} from "@/utils/phone";

/**
 * Field-level bounds for bulk-upload rows (students/parents).
 *
 * Invariant: no raw cell may reach a repository unbounded. The route bounds
 * bytes, the DTO bounds row count, and these helpers bound each field's
 * length and shape at normalization time. `file.type` and header aliases
 * are never trusted — only the normalized value is validated.
 *
 * Formula handling: import direction (CSV/XLSX → DB text) cannot execute
 * formulas; the risk would be a future *export* of stored values into a
 * spreadsheet. All template exports today are static header/example rows,
 * so no neutralization is applied on import — values are stored verbatim
 * within the bounds below. If a user-data XLSX export is ever added, values
 * beginning with `=`, `+`, `-`, `@` must be prefixed with `'` at export time.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function boundedField(
  value: string,
  field: string,
  rowIndex: number,
  maxLength: number
): string {
  if (value.length > maxLength) {
    throw new ValidationError(
      `Row ${rowIndex + 1}: ${field} exceeds ${maxLength} characters`
    );
  }
  return value;
}

export function optionalEmail(
  value: string | undefined,
  field: string,
  rowIndex: number
): string | undefined {
  if (!value) return undefined;
  if (value.length > 254 || !EMAIL_PATTERN.test(value)) {
    throw new ValidationError(`Row ${rowIndex + 1}: ${field} is not a valid email`);
  }
  return value;
}

export function requiredPhone(
  value: string,
  field: string,
  rowIndex: number
): string {
  const normalized = normalizePhoneNumber(value);
  if (!INDIAN_MOBILE_PATTERN.test(normalized)) {
    throw new ValidationError(`Row ${rowIndex + 1}: ${field} — ${PHONE_VALIDATION_MESSAGE}`);
  }
  return normalized;
}

export function optionalUuid(
  value: string | null,
  field: string,
  rowIndex: number
): string | null {
  if (!value) return null;
  if (!UUID_PATTERN.test(value)) {
    throw new ValidationError(`Row ${rowIndex + 1}: ${field} must be a UUID`);
  }
  return value;
}
