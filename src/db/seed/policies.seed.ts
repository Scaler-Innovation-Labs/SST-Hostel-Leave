import {
  leaveTypes,
  policies,
} from "@/db";
import type { db } from "@/lib/db";

export async function seedPolicies(
  database: typeof db
) {
  const leaveTypeRows =
    await database
      .select()
      .from(leaveTypes);

  const leaveTypeMap =
    new Map(
      leaveTypeRows.map(
        (leaveType) => [
          leaveType.code,
          leaveType.id,
        ]
      )
    );

  await database
    .insert(policies)
    .values([
      // =========================
      // HOME PASS
      // =========================

      {
        name:
          "Home Pass Maximum Days",

        policyType:
          "MAX_DAYS",

        priority: 1,

        leaveTypeId:
          leaveTypeMap.get(
            "HOME_PASS"
          ),

        config: {
          maxDays: 7,
        },
      },

      // =========================
      // MEDICAL
      // =========================

      {
        name:
          "Medical Extension Limit",

        policyType:
          "MAX_EXTENSION_COUNT",

        priority: 1,

        leaveTypeId:
          leaveTypeMap.get(
            "MEDICAL"
          ),

        config: {
          maxExtensionCount: 5,
        },
      },

      // =========================
      // NIGHT OUT
      // =========================

      {
        name:
          "Night Out Curfew",

        policyType:
          "CURFEW_RESTRICTION",

        priority: 10,

        leaveTypeId:
          leaveTypeMap.get(
            "NIGHT_OUT"
          ),

        config: {
          latestReturnTime:
            "22:00",
        },
      },

      // =========================
      // EXAM BLOCK
      // =========================

      {
        name:
          "Block During Exams",

        policyType:
          "BLOCK_DURING_PERIOD",

        priority: 100,

        config: {
          blockedPeriods: [
            "MID_EXAM",
            "FINAL_EXAM",
          ],
        },
      },
    ])
    .onConflictDoNothing();
}
