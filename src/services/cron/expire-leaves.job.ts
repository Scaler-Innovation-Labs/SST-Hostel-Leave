import { expireOverdueLeaves } from "@/services/leave/expire-leave.service";

const SYSTEM_USER = { id: "SYSTEM" };

export async function runExpireLeavesJob() {
  const result = await expireOverdueLeaves(SYSTEM_USER);

  return {
    job: "expire-leaves",
    ...result,
  };
}
