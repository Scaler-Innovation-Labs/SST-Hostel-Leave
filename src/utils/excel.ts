import ExcelJS from "exceljs";

/**
 * Bulk Excel parsing (client-side, SUPER_ADMIN bulk import).
 *
 * Replaces SheetJS `xlsx` (unpatched Prototype Pollution + ReDoS
 * advisories, end-of-line 0.18.x). exceljs is the maintained
 * replacement; parsing stays client-side so a crafted workbook can only
 * burn the uploader's own browser, and the server re-bounds everything
 * (5MB body, 2000 rows, per-field shapes in bulk-row-validation).
 *
 * Bounds enforced here mirror the server: 50 columns max, 2000 data rows
 * max. Header names are trimmed strings; `__proto__`-style headers are
 * kept as plain data keys on a null-prototype record so they cannot
 * pollute prototypes downstream.
 */
const MAX_BULK_EXCEL_COLUMNS = 50;
const MAX_BULK_EXCEL_ROWS = 2000;

function normalizeCell(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as {
      text?: unknown;
      result?: unknown;
      richText?: Array<{ text?: unknown }>;
    };
    // Formula cells: use the cached result, never the formula itself.
    if ("result" in v && v.result !== undefined) return normalizeCell(v.result as ExcelJS.CellValue);
    if (Array.isArray(v.richText)) return v.richText.map((r) => String(r.text ?? "")).join("");
    if (typeof v.text === "string") return v.text;
    return "";
  }
  return value;
}

export async function parseBulkExcel(
  buffer: ArrayBuffer
): Promise<Array<Record<string, unknown>>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("Excel file has no sheets");

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    headers.push(String(normalizeCell(cell.value)).trim());
  });

  if (headers.length === 0) throw new Error("Excel file has no header row");
  if (headers.length > MAX_BULK_EXCEL_COLUMNS) {
    throw new Error(
      `Excel file has too many columns (max ${MAX_BULK_EXCEL_COLUMNS})`
    );
  }

  const rows: Array<Record<string, unknown>> = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (rows.length >= MAX_BULK_EXCEL_ROWS) {
      throw new Error(
        `File exceeds the ${MAX_BULK_EXCEL_ROWS}-row upload limit`
      );
    }
    const record: Record<string, unknown> = Object.create(null);
    headers.forEach((header, idx) => {
      record[header] = normalizeCell(row.getCell(idx + 1).value);
    });
    // Skip fully-empty rows (trailing blanks, gaps).
    if (Object.values(record).every((v) => v === "")) return;
    rows.push(record);
  });

  return rows;
}
