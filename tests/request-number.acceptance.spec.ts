/**
 * Request-number collision acceptance: 100 concurrent allocations.
 *
 * Existing request numbers were built from `Date.now()`, so two creates in the
 * same millisecond could collide. Numbers now come from a PostgreSQL sequence,
 * which is atomic across concurrent connections.
 *
 * Runs ONLY with RUN_DB_ACCEPTANCE=1 and an applied migration state. Everywhere
 * else the suite reports it as skipped.
 */
import { describe, expect, it } from "vitest";

import { leaveRepository } from "@/db/repositories/leave/leave.repository";

const RUN = process.env.RUN_DB_ACCEPTANCE === "1";

describe.runIf(RUN)("leave request number generation", () => {
  it("issues 100 unique numbers under concurrency", async () => {
    const numbers = await Promise.all(
      Array.from({ length: 100 }, () => leaveRepository.nextRequestNumber())
    );

    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers.every((value) => /^LR-\d+$/.test(value))).toBe(true);
  });
});
