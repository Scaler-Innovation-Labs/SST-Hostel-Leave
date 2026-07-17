import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import { bulkCreateParents } from "@/services/parent/bulk-create-parents.service";

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
      return ApiResponse.error("VALIDATION_ERROR", "Expected a non-empty array of parent records", 400);
    }

    const parsed = await Promise.all(rows.map(async (row, i) => {
      const studentEmail = String(row.studentEmail ?? row["Student Email"] ?? row.student_email ?? "").trim().toLowerCase();
      const name = String(row.name ?? row["Name"] ?? row.fullName ?? row["Full Name"] ?? "").trim();
      const phone = String(row.phone ?? row["Phone"] ?? "").trim();
      const email = String(row.email ?? row["Email"] ?? "").trim() || undefined;
      const relationship = String(row.relationship ?? row["Relationship"] ?? "").trim();
      const isPrimaryRaw = String(row.isPrimary ?? row["Is Primary"] ?? row.is_primary ?? "").trim().toLowerCase();

      if (!studentEmail) throw new Error(`Row ${i + 1}: studentEmail is required`);

      const user = await userRepository.findByEmail(studentEmail);
      if (!user) throw new Error(`Row ${i + 1}: no user found with email "${studentEmail}"`);
      const student = await studentRepository.findByUserId(user.id);
      if (!student) throw new Error(`Row ${i + 1}: user "${studentEmail}" is not a student`);
      const studentId = student.id;

      if (!name) throw new Error(`Row ${i + 1}: name is required`);
      if (!name) throw new Error(`Row ${i + 1}: name is required`);
      if (!phone) throw new Error(`Row ${i + 1}: phone is required`);
      if (!relationship) throw new Error(`Row ${i + 1}: relationship is required`);

      const isPrimary = isPrimaryRaw === "true" || isPrimaryRaw === "1" || isPrimaryRaw === "yes";

      return {
        studentId,
        name,
        phone,
        email,
        relationship,
        isPrimary,
      };
    }));

    const results = await bulkCreateParents(parsed);

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
