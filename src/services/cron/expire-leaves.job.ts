import { type ExpireBatchResult, expireOverdueLeaves } from "@/services/leave/expire-leave.service";
import { type MarkOverdueBatchResult, markOverdueLeaves } from "@/services/leave/mark-overdue-leave.service";

const SYSTEM_USER = { id: "SYSTEM" };

export type ExpireLeavesJobResult = {
  job: "expire-leaves";
  expired: ExpireBatchResult;
  overdue: MarkOverdueBatchResult;
};

export async function runExpireLeavesJob(): Promise<ExpireLeavesJobResult> {
  const expired = await expireOverdueLeaves(SYSTEM_USER);
  const overdue = await markOverdueLeaves(SYSTEM_USER);

  return {
    job: "expire-leaves",
    expired,
    overdue,
  };
}