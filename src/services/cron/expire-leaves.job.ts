import { type ExpireBatchResult,expireOverdueLeaves } from "@/services/leave/expire-leave.service";

const SYSTEM_USER = { id: "SYSTEM" };

export async function runExpireLeavesJob(): Promise<{ job: string } & ExpireBatchResult> {
  const result = await expireOverdueLeaves(SYSTEM_USER);

  return {
    job: "expire-leaves",
    ...result,
  };
}
