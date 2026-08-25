import { eq } from "drizzle-orm";

import { leaveTypes } from "@/db/schema/leave";
import { policies } from "@/db/schema/policy";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

async function getLeaveTypeCodeMap(): Promise<Record<string, string>> {
  const types = await db.select({ id: leaveTypes.id, code: leaveTypes.code }).from(leaveTypes);
  return Object.fromEntries(types.map((t) => [t.code, t.id]));
}

export async function seedPolicies(): Promise<void> {
  const leaveTypeMap = await getLeaveTypeCodeMap();

  const policyConfigs: Array<{
    name: string;
    policyType: string;
    priority: number;
    leaveTypeCode: string | null;
    config: Record<string, unknown>;
  }> = [
    // LIMIT policies - max days per leave type
    {
      name: "Home Pass Max Days",
      policyType: "LIMIT",
      priority: 100,
      leaveTypeCode: "HOME_PASS",
      config: { type: "MAX_DAYS", maxDays: 7 },
    },
    {
      name: "Medical Leave Max Days",
      policyType: "LIMIT",
      priority: 100,
      leaveTypeCode: "MEDICAL",
      config: { type: "MAX_DAYS", maxDays: 30 },
    },
    {
      name: "Local Outing Max Days",
      policyType: "LIMIT",
      priority: 100,
      leaveTypeCode: "LOCAL_OUTING",
      config: { type: "MAX_DAYS", maxDays: 1 },
    },
    {
      name: "Night Out Max Days",
      policyType: "LIMIT",
      priority: 100,
      leaveTypeCode: "NIGHT_OUT",
      config: { type: "MAX_DAYS", maxDays: 2 },
    },
    {
      name: "Academic Leave Max Days",
      policyType: "LIMIT",
      priority: 100,
      leaveTypeCode: "ACADEMIC",
      config: { type: "MAX_DAYS", maxDays: 14 },
    },
    {
      name: "Hostel Leave Max Days",
      policyType: "LIMIT",
      priority: 100,
      leaveTypeCode: "HOSTEL",
      config: { type: "MAX_DAYS", maxDays: 7 },
    },
    {
      name: "Internship Max Days",
      policyType: "LIMIT",
      priority: 100,
      leaveTypeCode: "INTERNSHIP",
      config: { type: "MAX_DAYS", maxDays: 180 },
    },
    {
      name: "Marriage Bereavement Max Days",
      policyType: "LIMIT",
      priority: 100,
      leaveTypeCode: "MARRIAGE_BEREAVEMENT",
      config: { type: "MAX_DAYS", maxDays: 10 },
    },

    // LIMIT - max extensions
    {
      name: "Default Max Extensions",
      policyType: "LIMIT",
      priority: 200,
      leaveTypeCode: null,
      config: { type: "MAX_EXTENSION_COUNT", maxExtensionCount: 2 },
    },

    // ELIGIBILITY - parent approval required for certain leave types
    {
      name: "Home Pass Requires Parent Approval",
      policyType: "ELIGIBILITY",
      priority: 150,
      leaveTypeCode: "HOME_PASS",
      config: { type: "PARENT_APPROVAL_REQUIRED" },
    },
    {
      name: "Night Out Requires Parent Approval",
      policyType: "ELIGIBILITY",
      priority: 150,
      leaveTypeCode: "NIGHT_OUT",
      config: { type: "PARENT_APPROVAL_REQUIRED" },
    },
    {
      name: "Medical Leave Requires Parent Approval",
      policyType: "ELIGIBILITY",
      priority: 150,
      leaveTypeCode: "MEDICAL",
      config: { type: "PARENT_APPROVAL_REQUIRED" },
    },

    // ELIGIBILITY - batch restrictions (example: block final year from certain leaves)
    {
      name: "Final Year Local Outing Restriction",
      policyType: "ELIGIBILITY",
      priority: 300,
      leaveTypeCode: "LOCAL_OUTING",
      config: { type: "BATCH_RESTRICTION", blockedBatchYears: [2024] },
    },

    // TIME_WINDOW - curfew
    {
      name: "Default Curfew 22:00",
      policyType: "TIME_WINDOW",
      priority: 100,
      leaveTypeCode: null,
      config: { type: "CURFEW", latestReturnTime: "22:00" },
    },
    {
      name: "Night Out Curfew 23:00",
      policyType: "TIME_WINDOW",
      priority: 200,
      leaveTypeCode: "NIGHT_OUT",
      config: { type: "CURFEW", latestReturnTime: "23:00" },
    },
    {
      name: "Academic Leave Curfew 20:00",
      policyType: "TIME_WINDOW",
      priority: 200,
      leaveTypeCode: "ACADEMIC",
      config: { type: "CURFEW", latestReturnTime: "20:00" },
    },

    // FORM_VALIDATION - within days
    {
      name: "Exam Date Within 30 Days",
      policyType: "FORM_VALIDATION",
      priority: 100,
      leaveTypeCode: "ACADEMIC",
      config: { type: "WITHIN_DAYS", field: "examDate", maxDays: 30, message: "Exam date must be within 30 days from today" },
    },
    {
      name: "Internship Start Within 60 Days",
      policyType: "FORM_VALIDATION",
      priority: 100,
      leaveTypeCode: "INTERNSHIP",
      config: { type: "WITHIN_DAYS", field: "startDate", maxDays: 60, message: "Internship start date must be within 60 days from today" },
    },

    // FORM_VALIDATION - field restrictions (example: destination restrictions)
    {
      name: "Local Outing Destination Restrictions",
      policyType: "FORM_VALIDATION",
      priority: 100,
      leaveTypeCode: "LOCAL_OUTING",
      config: { type: "FIELD_RESTRICTION", fieldRestrictions: [{ fieldKey: "destination", disallowedValues: ["OUT_OF_CITY", "OVERNIGHT_STAY"] }] },
    },
  ];

  for (const policyConfig of policyConfigs) {
    const leaveTypeId = policyConfig.leaveTypeCode ? leaveTypeMap[policyConfig.leaveTypeCode] : null;

    if (policyConfig.leaveTypeCode && !leaveTypeId) {
      logger.warn("Leave type not found for policy", { leaveTypeCode: policyConfig.leaveTypeCode, policyName: policyConfig.name });
      continue;
    }

    const existing = await db
      .select()
      .from(policies)
      .where(eq(policies.name, policyConfig.name))
      .limit(1);

    if (existing.length > 0) {
      logger.debug("Policy already exists", { name: policyConfig.name });
      continue;
    }

    await db.insert(policies).values({
      name: policyConfig.name,
      policyType: policyConfig.policyType as typeof policies.$inferInsert.policyType,
      priority: policyConfig.priority,
      leaveTypeId,
      hostelId: null,
      departmentId: null,
      batchYear: null,
      config: policyConfig.config,
      isActive: true,
      startsAt: null,
      endsAt: null,
    });

    logger.info("Policy seeded", { name: policyConfig.name, policyType: policyConfig.policyType });
  }

  logger.info("Policies seed complete", { count: policyConfigs.length });
}