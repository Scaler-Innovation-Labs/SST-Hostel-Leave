import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { bulkCreateStudents } from "@/services/student/bulk-create-students.service";

export async function POST(request: Request) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const contentType = request.headers.get("content-type") ?? "";

    let rows: Array<Record<string, unknown>>;

    if (contentType.includes("text/csv") || contentType.includes("application/csv")) {
      const text = await request.text();
      rows = parseCsv(text);
    } else {
      rows = await request.json();
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return ApiResponse.error("VALIDATION_ERROR", "Expected a non-empty array of student records", 400);
    }

    const parsed = rows.map((row, i) => {
      const rollNumber = String(row.rollNumber ?? row["Roll Number"] ?? row.roll_number ?? "").trim();
      const fullName = String(row.fullName ?? row["Full Name"] ?? row.full_name ?? row.name ?? "").trim();
      const academicGroupId = String(row.academicGroupId ?? row["Academic Group ID"] ?? row.academic_group_id ?? "").trim();
      const email = String(row.email ?? row["Email"] ?? "").trim() || undefined;
      const phone = String(row.phone ?? row["Phone"] ?? "").trim() || undefined;
      const genderRaw = String(row.gender ?? row["Gender"] ?? "").trim().toUpperCase();
      const roomNumber = String(row.roomNumber ?? row["Room Number"] ?? row.room_number ?? "").trim() || null;
      const hostelId = String(row.hostelId ?? row["Hostel ID"] ?? row.hostel_id ?? "").trim() || null;

      if (!rollNumber) throw new Error(`Row ${i + 1}: rollNumber is required`);
      if (!fullName) throw new Error(`Row ${i + 1}: fullName is required`);
      if (!academicGroupId) throw new Error(`Row ${i + 1}: academicGroupId is required`);

      const gender = ["MALE", "FEMALE", "OTHER"].includes(genderRaw) ? (genderRaw as "MALE" | "FEMALE" | "OTHER") : null;

      return {
        rollNumber,
        fullName,
        academicGroupId,
        email,
        phone,
        gender,
        roomNumber,
        hostelId,
      };
    });

    const results = await bulkCreateStudents(parsed);

    return ApiResponse.success({
      total: results.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

function parseCsv(text: string): Array<Record<string, unknown>> {
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
