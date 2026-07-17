import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { TemplateFormatSchema } from "@/dto/shared/template-format.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";

export async function GET(request: Request) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN, ROLES.ADMIN]);

    const { searchParams } = new URL(request.url);
    const { format } = TemplateFormatSchema.parse(Object.fromEntries(searchParams));

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
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
