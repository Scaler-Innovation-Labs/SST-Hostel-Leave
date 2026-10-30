import { ValidationError } from "@/lib/errors";

/**
 * Transport-level bound for JSON route bodies.
 *
 * Invariant: no unbounded payload may reach Zod parsing or jsonb columns.
 * DTOs bound fields and rows; this bounds bytes. Bulk uploads use the
 * stricter `readBoundedBodyText` (5MB CSV-aware) instead.
 */
export const MAX_JSON_BODY_BYTES = 1_000_000;

export type ReadBoundedJsonOptions = {
  allowEmpty?: boolean;
}

export async function readBoundedJson(
  request: Request,
  maxBytesOrOptions?: number | ReadBoundedJsonOptions,
  maybeOptions?: ReadBoundedJsonOptions
): Promise<unknown> {
  let maxBytes = MAX_JSON_BODY_BYTES;
  let options: ReadBoundedJsonOptions | undefined;

  if (typeof maxBytesOrOptions === "number") {
    maxBytes = maxBytesOrOptions;
    options = maybeOptions;
  } else if (typeof maxBytesOrOptions === "object" && maxBytesOrOptions !== null) {
    options = maxBytesOrOptions;
  }

  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ValidationError("Request body exceeds the size limit");
  }

  const text = await request.text();
  if (text.length > maxBytes) {
    throw new ValidationError("Request body exceeds the size limit");
  }

  if (options?.allowEmpty && text.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError("Request body is not valid JSON");
  }
}
