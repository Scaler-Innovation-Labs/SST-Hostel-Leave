import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "xlsx";

  const headerRow = [
    "studentEmail",
    "name",
    "phone",
    "email",
    "relationship",
    "isPrimary",
  ];

  const exampleRow = [
    "student@example.com",
    "John Doe Sr.",
    "9876543210",
    "parent@example.com",
    "father",
    "true",
  ];

  if (format === "csv") {
    const csv = [headerRow.join(","), exampleRow.join(",")].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="parent-bulk-upload-template.csv"',
      },
    });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headerRow, exampleRow]);
  XLSX.utils.book_append_sheet(wb, ws, "Parents");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="parent-bulk-upload-template.xlsx"',
    },
  });
}
