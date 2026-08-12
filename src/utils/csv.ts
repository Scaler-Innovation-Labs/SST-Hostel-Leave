/**
 * Parses a simple CSV string into rows keyed by the header row.
 * Handles trimming and skips blank lines. Not a full RFC-4180 parser —
 * sufficient for the bulk-upload templates used by this app.
 */
export function parseCsv(text: string): Array<Record<string, unknown>> {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0]!.split(",").map((h) => h.trim());
  const rows: Array<Record<string, unknown>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]!.split(",").map((v) => v.trim());
    const row: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}
