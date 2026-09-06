import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { parseBulkExcel } from "@/utils/excel";

// exceljs is heavy to initialize; allow generous time per case.
const SLOW = 30_000;

async function buildWorkbook(
  rows: Array<Array<string | number>>
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1");
  rows.forEach((row) => worksheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer instanceof ArrayBuffer
    ? buffer
    : new Uint8Array(buffer).buffer as ArrayBuffer;
}

describe("parseBulkExcel", () => {
  // The global setup fakes timers; exceljs stream I/O needs real ones.
  beforeAll(() => {
    vi.useRealTimers();
  });

  it("parses header-keyed rows", async () => {
    const buf = await buildWorkbook([
      ["rollNumber", "fullName"],
      ["S001", "John Doe"],
      ["S002", "Jane Roe"],
    ]);

    const rows = await parseBulkExcel(buf);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ rollNumber: "S001", fullName: "John Doe" });
    expect(rows[1]).toMatchObject({ rollNumber: "S002", fullName: "Jane Roe" });
  });

  it("skips fully-empty rows", async () => {
    const buf = await buildWorkbook([
      ["rollNumber", "fullName"],
      ["S001", "John Doe"],
      ["", ""],
    ]);

    const rows = await parseBulkExcel(buf);

    expect(rows).toHaveLength(1);
  });

  it("uses cached formula results, never the formula itself", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sheet1");
    worksheet.addRow(["name", "code"]);
    worksheet.addRow(["John", { formula: "1+1", result: 2 }]);
    const raw = await workbook.xlsx.writeBuffer();
    const buf =
      raw instanceof ArrayBuffer ? raw : new Uint8Array(raw).buffer as ArrayBuffer;

    const rows = await parseBulkExcel(buf);

    expect(rows[0]).toMatchObject({ name: "John", code: 2 });
  });

  it("rejects workbooks without sheets or headers", async () => {
    const empty = new ExcelJS.Workbook();
    const emptyRaw = await empty.xlsx.writeBuffer();
    const emptyBuf =
      emptyRaw instanceof ArrayBuffer ? emptyRaw : new Uint8Array(emptyRaw).buffer as ArrayBuffer;
    await expect(parseBulkExcel(emptyBuf)).rejects.toThrow(/no sheets/i);

    const headerless = new ExcelJS.Workbook();
    headerless.addWorksheet("Sheet1");
    const headerlessRaw = await headerless.xlsx.writeBuffer();
    const headerlessBuf =
      headerlessRaw instanceof ArrayBuffer
        ? headerlessRaw
        : new Uint8Array(headerlessRaw).buffer as ArrayBuffer;
    await expect(parseBulkExcel(headerlessBuf)).rejects.toThrow(/header/i);
  });

  it("rejects more than 50 columns", async () => {
    const headers = Array.from({ length: 51 }, (_, i) => `col${i}`);
    const buf = await buildWorkbook([headers, headers.map(() => "x")]);

    await expect(parseBulkExcel(buf)).rejects.toThrow(/too many columns/i);
  });
}, SLOW);
