import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

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

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Parents");
    worksheet.addRows([headerRow, exampleRow]);
    const buf = await workbook.xlsx.writeBuffer();

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="parent-bulk-upload-template.xlsx"',
      },
    });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
