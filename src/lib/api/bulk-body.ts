import { ValidationError } from "@/lib/errors";

/**
 * Transport-level guard for bulk-upload routes (students/parents).
 *
 * Invariant: no unbounded body may reach the CSV/JSON parsers. The DTO row
 * cap (2000) bounds *rows*; this bounds *bytes* — a single 100MB cell must
 * fail before parsing, not inside it.
 */
export const MAX_BULK_PAYLOAD_BYTES = 5_000_000;

export async function readBoundedBodyText(request: Request): Promise<string> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_BULK_PAYLOAD_BYTES) {
    throw new ValidationError(
      `Upload payload exceeds the ${MAX_BULK_PAYLOAD_BYTES / 1_000_000}MB limit`
    );
  }

  const text = await request.text();
  if (text.length > MAX_BULK_PAYLOAD_BYTES) {
    throw new ValidationError(
      `Upload payload exceeds the ${MAX_BULK_PAYLOAD_BYTES / 1_000_000}MB limit`
    );
  }
  return text;
}
