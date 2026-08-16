import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { userRoleRepository } from "@/db/repositories/auth/user-role.repository";
import { parentRepository } from "@/db/repositories/parent/parent.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import { ROLES } from "@/lib/auth/roles";
import { transaction } from "@/lib/db/transaction";
import { ConflictError, ValidationError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export type BulkStudentResult = {
  rollNumber: string;
  success: boolean;
  error?: string;
};

/**
 * Normalizes a single raw upload row (JSON or CSV headers) into the shape
 * required by the student/user repositories. Validation lives here, in the
 * service layer — routes must not perform business validation.
 */
export function normalizeStudentRow(
  row: Record<string, unknown>,
  index: number,
): {
  rollNumber: string;
  fullName: string;
  academicGroupId: string;
  email?: string | null;
  phone?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  roomNumber?: string | null;
  hostelId?: string | null;
  parentName: string;
  parentPhone: string;
  parentEmail?: string | null;
  parentRelationship: string;
} {
  const rollNumber = String(row.rollNumber ?? row["Roll Number"] ?? row.roll_number ?? "").trim();
  const fullName = String(row.fullName ?? row["Full Name"] ?? row.full_name ?? row.name ?? "").trim();
  const academicGroupId = String(
    row.academicGroupId ?? row["Academic Group ID"] ?? row.academic_group_id ?? "",
  ).trim();
  const email = String(row.email ?? row["Email"] ?? "").trim() || undefined;
  const phone = String(row.phone ?? row["Phone"] ?? "").trim() || undefined;
  const genderRaw = String(row.gender ?? row["Gender"] ?? "").trim().toUpperCase();
  const roomNumber = String(row.roomNumber ?? row["Room Number"] ?? row.room_number ?? "").trim() || null;
  const hostelId = String(row.hostelId ?? row["Hostel ID"] ?? row.hostel_id ?? "").trim() || null;
  const parentName = String(row.parentName ?? row["Parent Name"] ?? row.parent_name ?? "").trim();
  const parentPhone = String(row.parentPhone ?? row["Parent Phone"] ?? row.parent_phone ?? "").trim();
  const parentEmail = String(row.parentEmail ?? row["Parent Email"] ?? row.parent_email ?? "").trim() || undefined;
  const parentRelationship = String(
    row.parentRelationship ?? row["Parent Relationship"] ?? row.parent_relationship ?? "",
  ).trim();

  if (!rollNumber) throw new ValidationError(`Row ${index + 1}: rollNumber is required`);
  if (!fullName) throw new ValidationError(`Row ${index + 1}: fullName is required`);
  if (!academicGroupId) throw new ValidationError(`Row ${index + 1}: academicGroupId is required`);
  if (!parentName) throw new ValidationError(`Row ${index + 1}: parentName is required`);
  if (!parentPhone) throw new ValidationError(`Row ${index + 1}: parentPhone is required`);
  if (!parentRelationship) throw new ValidationError(`Row ${index + 1}: parentRelationship is required`);

  const gender = ["MALE", "FEMALE", "OTHER"].includes(genderRaw)
    ? (genderRaw as "MALE" | "FEMALE" | "OTHER")
    : null;

  return {
    rollNumber,
    fullName,
    academicGroupId,
    email,
    phone,
    gender,
    roomNumber,
    hostelId,
    parentName,
    parentPhone,
    parentEmail,
    parentRelationship,
  };
}

/**
 * Bulk-creates students from raw upload rows (JSON objects or CSV-derived
 * rows). Each row is normalized and created in its own transaction so one
 * bad row does not fail the whole batch.
 */
export async function bulkCreateStudents(
  rows: Array<Record<string, unknown>>,
  actorUserId: string | null = null,
): Promise<BulkStudentResult[]> {
  const results: BulkStudentResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]!;
    let rollNumber = "";
    try {
      const row = normalizeStudentRow(raw, i);
      rollNumber = row.rollNumber;

      const student = await transaction(async (tx) => {
        const existing = await studentRepository.findByRollNumber(row.rollNumber, tx);
        if (existing) {
          throw new ConflictError("Roll number already exists");
        }

        const [roleRow] = await userRoleRepository.findRolesByCodes([ROLES.STUDENT], tx);

        const user = await userRepository.create(
          {
            fullName: row.fullName,
            email: row.email || undefined,
            phone: row.phone || undefined,
            gender: row.gender ?? null,
            hostelId: row.hostelId ?? undefined,
          },
          tx,
        );

        const createdStudent = await studentRepository.create(
          {
            userId: user.id,
            rollNumber: row.rollNumber,
            academicGroupId: row.academicGroupId,
            roomNumber: row.roomNumber ?? null,
            currentLocationState: MOVEMENT_STATE.IN_HOSTEL,
          },
          tx,
        );

        // Same invariant as single-create: every student gets a primary
        // parent at creation time.
        await parentRepository.create(
          {
            studentId: createdStudent.id,
            name: row.parentName,
            phone: row.parentPhone,
            email: row.parentEmail || null,
            relationship: row.parentRelationship,
            isPrimary: true,
          },
          tx,
        );

        if (roleRow) {
          await userRoleRepository.create(user.id, roleRow.id, tx);
        }

        return createdStudent;
      });

      if (actorUserId) {
        await auditService.record(
          AUDIT_ACTION.CREATE,
          AUDIT_ENTITY_TYPE.STUDENT,
          student.id,
          actorUserId,
          { rollNumber: row.rollNumber ?? rollNumber, fullName: row.fullName ?? "" },
        );
      }

      results.push({ rollNumber, success: true });
    } catch (err) {
      results.push({
        rollNumber,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return results;
}
