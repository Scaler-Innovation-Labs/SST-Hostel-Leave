import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "xlsx";

  const headerRow = [
    "rollNumber",
    "fullName",
    "academicGroupId",
    "email",
    "phone",
    "gender",
    "roomNumber",
    "hostelId",
  ];

  const exampleRow = [
    "S001",
    "John Doe",
    "<academic-group-uuid>",
    "john@example.com",
    "9876543210",
    "MALE",
    "A-101",
    "<hostel-uuid-or-empty>",
  ];

  if (format === "csv") {
    const csv = [headerRow.join(","), exampleRow.join(",")].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="student-bulk-upload-template.csv"',
      },
    });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headerRow, exampleRow]);
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="student-bulk-upload-template.xlsx"',
    },
  });
}
