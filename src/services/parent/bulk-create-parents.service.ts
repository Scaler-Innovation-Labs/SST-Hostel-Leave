import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { parentRepository } from "@/db/repositories/parent/parent.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export type BulkParentRow = {
  studentId: string;
  name: string;
  phone: string;
  email?: string | null;
  relationship: string;
  isPrimary: boolean;
};

export type BulkParentResult = {
  row: number;
  success: boolean;
  error?: string;
};

/**
 * Normalizes a single raw upload row (JSON or CSV headers) into the shape
 * required by the parent repository. Row validation lives here, in the
 * service layer — routes must not perform business validation.
 */
export function normalizeParentRow(
  row: Record<string, unknown>,
  index: number,
): BulkParentRow {
  const studentEmail = String(
    row.studentEmail ?? row["Student Email"] ?? row.student_email ?? "",
  )
    .trim()
    .toLowerCase();
  const name = String(row.name ?? row["Name"] ?? row.fullName ?? row["Full Name"] ?? "").trim();
  const phone = String(row.phone ?? row["Phone"] ?? "").trim();
  const email = String(row.email ?? row["Email"] ?? "").trim() || undefined;
  const relationship = String(row.relationship ?? row["Relationship"] ?? "").trim();
  const isPrimaryRaw = String(
    row.isPrimary ?? row["Is Primary"] ?? row.is_primary ?? "",
  )
    .trim()
    .toLowerCase();

  if (!studentEmail) throw new ValidationError(`Row ${index + 1}: studentEmail is required`);
  if (!name) throw new ValidationError(`Row ${index + 1}: name is required`);
  if (!phone) throw new ValidationError(`Row ${index + 1}: phone is required`);
  if (!relationship) throw new ValidationError(`Row ${index + 1}: relationship is required`);

  const isPrimary =
    isPrimaryRaw === "true" || isPrimaryRaw === "1" || isPrimaryRaw === "yes";

  return {
    studentId: "",
    name,
    phone,
    email,
    relationship,
    isPrimary,
  };
}

/**
 * Resolves the student id for a normalized row by looking up the user by
 * email. Throws if the email does not belong to a student.
 */
export async function resolveStudentId(studentEmail: string): Promise<string> {
  const user = await userRepository.findByEmail(studentEmail);
  if (!user) {
    throw new NotFoundError(`user with email "${studentEmail}"`);
  }
  const student = await studentRepository.findByUserId(user.id);
  if (!student) {
    throw new NotFoundError(`user "${studentEmail}" is not a student`);
  }
  return student.id;
}

/**
 * Bulk-creates parents from raw upload rows (JSON objects or CSV-derived
 * rows). Each row is normalized, its student resolved, and created in
 * isolation so one bad row does not fail the whole batch.
 */
export async function bulkCreateParents(
  rows: Array<Record<string, unknown>>,
  actorUserId: string | null = null,
): Promise<BulkParentResult[]> {
  const results: BulkParentResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]!;
    try {
      const normalized = normalizeParentRow(raw, i);

      const studentEmail = String(
        raw.studentEmail ?? raw["Student Email"] ?? raw.student_email ?? "",
      )
        .trim()
        .toLowerCase();
      normalized.studentId = await resolveStudentId(studentEmail);

      const parent = await parentRepository.create({
        studentId: normalized.studentId,
        name: normalized.name,
        phone: normalized.phone,
        email: normalized.email ?? null,
        relationship: normalized.relationship,
        isPrimary: normalized.isPrimary,
      });

      if (actorUserId) {
        await auditService.record(
          AUDIT_ACTION.CREATE,
          AUDIT_ENTITY_TYPE.STUDENT,
          normalized.studentId,
          actorUserId,
          { parentId: parent.id, name: normalized.name },
        );
      }

      results.push({ row: i + 1, success: true });
    } catch (err) {
      results.push({
        row: i + 1,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return results;
}
