import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { eq } from "drizzle-orm";

import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { roles, userRoles } from "@/db";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { ROLES } from "@/lib/auth/roles";
import { db } from "@/lib/db";

async function main() {
  const pocRole = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, ROLES.POC)).limit(1);
  if (pocRole.length === 0) {
    console.log("No POC role — nothing to verify.");
    return;
  }

  const scopes = await db
    .select({ userId: userRoles.userId, scopeType: userRoles.scopeType, scopeId: userRoles.scopeId })
    .from(userRoles)
    .where(eq(userRoles.roleId, pocRole[0]!.id));

  const pocUserIds = [...new Set(scopes.map((s) => s.userId))];

  for (const pocUserId of pocUserIds) {
    const hostelIds = scopes
      .filter((s) => s.userId === pocUserId && s.scopeType === "HOSTEL" && !!s.scopeId)
      .map((s) => s.scopeId as string);

    // Same call list-approvals.service makes for a POC user.
    const result = await leaveApprovalRepository.findByFilters({
      status: LEAVE_APPROVAL_DECISION.PENDING,
      approverUserId: pocUserId,
      hostelIds: hostelIds.length > 0 ? hostelIds : undefined,
      excludeLeaveStatuses: [LEAVE_REQUEST_STATUS.CANCELLED],
      page: 1,
      limit: 50,
    });

    console.log(`\nPOC user ${pocUserId} (scoped hostels: ${hostelIds.length > 0 ? hostelIds.join(", ") : "ALL"}):`);
    console.log(`  Pending tickets in queue: ${result.total}`);
    for (const item of result.items) {
      console.log(
        `    - ${item.leaveRequest?.requestNumber} | ${item.leaveRequest?.reason} | step=${item.stepKey}@${item.stepOrder} | decision=${item.decision} | approver=${item.approverUserId}`
      );
    }
  }
}

main()
  .catch((e) => {
    console.error("❌ Failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit());
