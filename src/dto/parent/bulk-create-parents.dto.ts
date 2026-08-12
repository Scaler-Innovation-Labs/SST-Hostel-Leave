import { z } from "zod";

/**
 * Bulk parent upload accepts either a CSV payload (parsed server-side into
 * rows) or a JSON array. Each row is a flat object whose keys may come in
 * multiple aliases (camelCase, snake_case, or the CSV template headers),
 * so rows are validated loosely here and normalized in the service.
 */
export const bulkCreateParentsSchema = z
  .array(z.record(z.string(), z.unknown()))
  .min(1)
  .max(2000);

export type BulkCreateParentsDto = z.infer<typeof bulkCreateParentsSchema>;
