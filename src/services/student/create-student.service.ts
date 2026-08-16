import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { userRoleRepository } from "@/db/repositories/auth/user-role.repository";
import { parentRepository } from "@/db/repositories/parent/parent.repository";
import { type Student,studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import type { CreateStudentDto } from "@/dto/student/create-student.dto";
import { ROLES } from "@/lib/auth/roles";
import { transaction } from "@/lib/db/transaction";
import { ConflictError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function createStudent(
  dto: CreateStudentDto,
  actorUserId: string | null = null,
): Promise<Student> {
  return transaction(async (tx) => {
    const existingRoll = await studentRepository.findByRollNumber(dto.rollNumber, tx);
    if (existingRoll) {
      throw new ConflictError("Roll number already exists");
    }

    const [roleRow] = await userRoleRepository.findRolesByCodes([ROLES.STUDENT], tx);

    const user = await userRepository.create(
      {
        fullName: dto.fullName,
        email: dto.email || undefined,
        phone: dto.phone || undefined,
        gender: dto.gender ?? null,
        hostelId: dto.hostelId ?? undefined,
      },
      tx,
    );

    const student = await studentRepository.create(
      {
        userId: user.id,
        rollNumber: dto.rollNumber,
        academicGroupId: dto.academicGroupId,
        roomNumber: dto.roomNumber ?? null,
        currentLocationState: MOVEMENT_STATE.IN_HOSTEL,
      },
      tx,
    );

    // Every student gets a primary parent at creation time so workflow
    // steps that require parent approval always have someone to send the
    // approval link to.
    await parentRepository.create(
      {
        studentId: student.id,
        name: dto.parentName,
        phone: dto.parentPhone,
        email: dto.parentEmail || null,
        relationship: dto.parentRelationship,
        isPrimary: true,
      },
      tx,
    );

    if (roleRow) {
      await userRoleRepository.create(user.id, roleRow.id, tx);
    }

    if (actorUserId) {
      await auditService.record(
        AUDIT_ACTION.CREATE,
        AUDIT_ENTITY_TYPE.STUDENT,
        student.id,
        actorUserId,
        { rollNumber: dto.rollNumber, fullName: dto.fullName },
        tx,
      );
    }

    return student;
  });
}
