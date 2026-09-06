import { ValidationError } from "@/lib/errors";

/**
 * Transport-level bound for JSON route bodies.
 *
 * Invariant: no unbounded payload may reach Zod parsing or jsonb columns.
 * DTOs bound fields and rows; this bounds bytes. Bulk uploads use the
 * stricter `readBoundedBodyText` (5MB CSV-aware) instead.
 */
export const MAX_JSON_BODY_BYTES = 1_000_000;

export async function readBoundedJson(request: Request, maxBytes: number = MAX_JSON_BODY_BYTES): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ValidationError("Request body exceeds the size limit");
  }

  const text = await request.text();
  if (text.length > maxBytes) {
    throw new ValidationError("Request body exceeds the size limit");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError("Request body is not valid JSON");
  }
}
