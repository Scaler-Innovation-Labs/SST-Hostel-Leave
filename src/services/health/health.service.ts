import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export type HealthStatus = {
  status: "ok" | "degraded";
  timestamp: string;
  service: string;
};

/**
 * Public liveness/readiness signal. Deliberately minimal: no environment
 * name, no app version, no per-integration configured/missing presence —
 * that detail is a reconnaissance oracle and does not belong on an
 * unauthenticated endpoint. The only signal is a readiness boolean driven
 * by database reachability (an attacker can already infer DB health from
 * overall app behavior, so this reveals nothing new).
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  let status: "ok" | "degraded" = "ok";

  try {
    await db.execute(sql`SELECT 1`);
  } catch (error) {
    status = "degraded";
    logger.error("Health check: database connection failed", { error });
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    service: "sst-hostel-leave",
  };
}
