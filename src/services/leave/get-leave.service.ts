import { leaveRepository, type LeaveWithRelations } from "@/db/repositories/leave/leave.repository";
import type { CurrentUser } from "@/lib/auth/types";
import { NotFoundError } from "@/lib/errors";
import { assertCanAccessLeave } from "@/services/shared/authorization.service";

export async function getLeave(id: string, currentUser: CurrentUser): Promise<LeaveWithRelations> {
  const result = await leaveRepository.findByIdWithRelations(id);

  if (!result) {
    throw new NotFoundError("LeaveRequest");
  }

  await assertCanAccessLeave(currentUser, result.leave);

  return result;
}

