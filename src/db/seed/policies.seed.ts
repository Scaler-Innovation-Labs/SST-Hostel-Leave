import {
  leaveTypes,
  policies,
} from "@/db";
import type { db } from "@/lib/db";

type PolicySeed = {
  name: string;
  policyType: string;
  priority: number;
  leaveTypeCode: string;
  config: Record<string, unknown>;
};

const POLICIES: PolicySeed[] = [
  // ==========================
  // RE EXAM
  // ==========================
  {
    name: "Re Exam Eligibility",
    policyType: "FORM_VALIDATION",
    priority: 10,
    leaveTypeCode: "RE_EXAM",
    config: {
      type: "WITHIN_DAYS",
      field: "examDate",
      reference: "today",
      maxDays: 30,
      message: "Exam date must be within 30 days from today.",
    },
  },

  // ==========================
  // LONG LEAVE
  // ==========================
  {
    name: "Long Leave Maximum Days",
    policyType: "LIMIT",
    priority: 1,
    leaveTypeCode: "LONG_LEAVE",
    config: { type: "MAX_DAYS", maxDays: 7 },
  },
  {
    name: "Long Leave Expiry",
    policyType: "TIME_WINDOW",
    priority: 1,
    leaveTypeCode: "LONG_LEAVE",
    config: { type: "LEAVE_EXPIRY", expireAfterHours: 24 },
  },

  // ==========================
  // LATE ENTRY
  // ==========================
  {
    name: "Late Entry Expiry",
    policyType: "TIME_WINDOW",
    priority: 1,
    leaveTypeCode: "LATE_ENTRY",
    config: { type: "LEAVE_EXPIRY", expireAfterHours: 6 },
  },

  // ==========================
  // DIFFERENT HOSTEL
  // ==========================
  {
    name: "Different Hostel Maximum Days",
    policyType: "LIMIT",
    priority: 1,
    leaveTypeCode: "DIFFERENT_HOSTEL",
    config: { type: "MAX_DAYS", maxDays: 3 },
  },
  {
    name: "Different Hostel Expiry",
    policyType: "TIME_WINDOW",
    priority: 1,
    leaveTypeCode: "DIFFERENT_HOSTEL",
    config: { type: "LEAVE_EXPIRY", expireAfterHours: 6 },
  },

  // ==========================
  // HOLIDAY
  // ==========================
  {
    name: "Holiday Maximum Days",
    policyType: "LIMIT",
    priority: 1,
    leaveTypeCode: "HOLIDAY",
    config: { type: "MAX_DAYS", maxDays: 14 },
  },
  {
    name: "Holiday Expiry",
    policyType: "TIME_WINDOW",
    priority: 1,
    leaveTypeCode: "HOLIDAY",
    config: { type: "LEAVE_EXPIRY", expireAfterHours: 12 },
  },

  // ==========================
  // INTERNSHIP
  // ==========================
  {
    name: "Internship Maximum Days",
    policyType: "LIMIT",
    priority: 1,
    leaveTypeCode: "INTERNSHIP",
    config: { type: "MAX_DAYS", maxDays: 30 },
  },
  {
    name: "Internship Expiry",
    policyType: "TIME_WINDOW",
    priority: 1,
    leaveTypeCode: "INTERNSHIP",
    config: { type: "LEAVE_EXPIRY", expireAfterHours: 48 },
  },

  // ==========================
  // GLOBAL POLICIES
  // ==========================
  {
    name: "Block During Exams",
    policyType: "TIME_WINDOW",
    priority: 100,
    leaveTypeCode: "",
    config: { type: "BLOCKED_PERIOD", blockedPeriods: ["MID_EXAM", "FINAL_EXAM"] },
  },
];

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
    .values(
      POLICIES.map((p) => ({
        name: p.name,
        policyType: p.policyType as "FORM_VALIDATION" | "ELIGIBILITY" | "LIMIT" | "WORKFLOW" | "DOCUMENT_REQUIREMENT" | "QR_RULE" | "TIME_WINDOW" | "FEATURE_FLAG",
        priority: p.priority,
        leaveTypeId: p.leaveTypeCode
          ? leaveTypeMap.get(p.leaveTypeCode) ?? null
          : null,
        config: p.config,
      }))
    )
    .onConflictDoNothing();
}
