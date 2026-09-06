import { ValidationError } from "@/lib/errors";

/**
 * Parses a simple CSV string into rows keyed by the header row.
 * Handles trimming and skips blank lines. Not a full RFC-4180 parser —
 * sufficient for the bulk-upload templates used by this app.
 *
 * Bounds (bulk-upload hardening): at most 50 columns, header names capped at
 * 100 chars, cell values capped at 5000 chars. Row count is bounded by the
 * bulk DTOs (max 2000); payload bytes are bounded by the route guard
 * (`readBoundedBodyText`). Anything beyond fails fast instead of entering
 * the service layer.
 */
const MAX_CSV_COLUMNS = 50;
const MAX_CSV_HEADER_LENGTH = 100;
const MAX_CSV_CELL_LENGTH = 5000;

export function parseCsv(text: string): Array<Record<string, unknown>> {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0]!.split(",").map((h) => h.trim());
  if (headers.length > MAX_CSV_COLUMNS) {
    throw new ValidationError(`CSV has too many columns (max ${MAX_CSV_COLUMNS})`);
  }
  for (const header of headers) {
    if (header.length > MAX_CSV_HEADER_LENGTH) {
      throw new ValidationError("CSV header name exceeds 100 characters");
    }
  }

  const rows: Array<Record<string, unknown>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]!.split(",").map((v) => v.trim());
    const row: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      const cell = values[idx] ?? "";
      if (cell.length > MAX_CSV_CELL_LENGTH) {
        throw new ValidationError(`CSV row ${i + 1} exceeds the per-cell limit`);
      }
      row[header] = cell;
    });
    rows.push(row);
  }

  return rows;
}
