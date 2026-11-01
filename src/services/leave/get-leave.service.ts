import { systemActor } from "@/constants/audit/actor";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { leaveRepository, type LeaveWithRelations } from "@/db/repositories/leave/leave.repository";
import type { CurrentUser } from "@/lib/auth/types";
import { NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { expireSingleLeave } from "@/services/leave/expire-leave.service";
import { assertCanAccessLeave } from "@/services/shared/authorization.service";

export async function getLeave(id: string, currentUser: CurrentUser): Promise<LeaveWithRelations> {
  let result = await leaveRepository.findByIdWithRelations(id);

  if (!result) {
    throw new NotFoundError("LeaveRequest");
  }

  await assertCanAccessLeave(currentUser, result.leave);

  if (result.leave.status === LEAVE_REQUEST_STATUS.PENDING) {
    const isExpired = await leaveRepository.hasExpiredParentApproval(id);
    if (isExpired) {
      try {
        await expireSingleLeave(id, systemActor("parent-link-expired"));
        const refreshed = await leaveRepository.findByIdWithRelations(id);
        if (refreshed) {
          result = refreshed;
        }
      } catch (err) {
        logger.warn("Failed to auto-expire leave with expired parent approval on getLeave", {
          leaveId: id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return result;
}
