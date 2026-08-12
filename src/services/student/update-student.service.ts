import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { studentRepository, type StudentWithRelations } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import type { UpdateStudentDto } from "@/dto/student/update-student.dto";
import { transaction } from "@/lib/db/transaction";
import { NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function updateStudent(
  id: string,
  dto: UpdateStudentDto,
  actorUserId: string | null = null,
): Promise<StudentWithRelations> {
  return transaction(async (tx) => {
    const existing = await studentRepository.findById(id, tx);
    if (!existing) {
      throw new NotFoundError("Student");
    }

    const studentFields: Partial<Parameters<typeof studentRepository.updateById>[1]> = {};
    if (dto.rollNumber !== undefined) studentFields.rollNumber = dto.rollNumber;
    if (dto.academicGroupId !== undefined) studentFields.academicGroupId = dto.academicGroupId;
    if (dto.roomNumber !== undefined) studentFields.roomNumber = dto.roomNumber;

    if (Object.keys(studentFields).length > 0) {
      await studentRepository.updateById(id, studentFields, tx);
    }

    const userFields: Parameters<typeof userRepository.updateUser>[1] = {};
    if (dto.fullName !== undefined) userFields.fullName = dto.fullName;
    if (dto.email !== undefined) userFields.email = dto.email || "";
    if (dto.phone !== undefined) userFields.phone = dto.phone || "";
    if (dto.gender !== undefined) userFields.gender = dto.gender;
    if (dto.isActive !== undefined) userFields.isActive = dto.isActive;
    if (dto.hostelId !== undefined) userFields.hostelId = dto.hostelId ?? null;

    if (Object.keys(userFields).length > 0) {
      await userRepository.updateUser(existing.userId, userFields, tx);
    }

    const updated = await studentRepository.findByIdWithRelations(id, tx);
    if (!updated) throw new NotFoundError("Student");

    if (actorUserId) {
      await auditService.record(
        AUDIT_ACTION.UPDATE,
        AUDIT_ENTITY_TYPE.STUDENT,
        id,
        actorUserId,
        { dto },
        tx,
      );
    }

    return updated;
  });
}
