import { operationalPeriodRepository } from "@/db/repositories/policy/operational-period.repository";
import type { Policy } from "@/db/repositories/policy/policy.repository";
import { policyRepository } from "@/db/repositories/policy/policy.repository";
import { db } from "@/lib/db";
import type { PolicyResult } from "@/types/policy/policy-result";

type PolicyEvaluationContext = {
  leaveType: {
    id: string;
    code: string;
    defaultWorkflowId: string | null;
    maxExtensionCount: number | null;
    allowExtensions: boolean;
  };
  leaveDurationDays?: number;
  studentBatchYear?: number;
  startAt?: Date;
  endAt?: Date;
  expectedReturnAt?: Date;
  extensionCount?: number;
  hostelId?: string | null;
  studentDepartmentId?: string | null;
  submittedForm?: Record<string, unknown>;
};

type PolicyDbClient = Pick<typeof db, "select">;

function evaluatePolicy(
  policy: Policy,
  context: PolicyEvaluationContext
): string | null {
  switch (policy.policyType) {
    case "MAX_DAYS": {
      const maxDays = (policy.config as { maxDays?: number }).maxDays;
      if (
        maxDays != null &&
        context.leaveDurationDays != null &&
        context.leaveDurationDays > maxDays
      ) {
        return `${policy.name}: Max ${maxDays} days allowed`;
      }
      return null;
    }

    case "RESTRICT_BATCH": {
      const blockedBatchYears = (policy.config as { blockedBatchYears?: number[] })
        .blockedBatchYears;
      if (
        blockedBatchYears?.length &&
        context.studentBatchYear != null &&
        blockedBatchYears.includes(context.studentBatchYear)
      ) {
        return `${policy.name}: Batch ${context.studentBatchYear} is restricted`;
      }
      return null;
    }

    case "CURFEW_RESTRICTION": {
      const latestReturnTime = (policy.config as { latestReturnTime?: string })
        .latestReturnTime;
      if (!latestReturnTime || !context.expectedReturnAt) {
        return null;
      }

      const parts = latestReturnTime.split(":").map(Number);
      if (parts.length !== 2 || parts.some(isNaN)) {
        return null;
      }
      const curfewHour = parts[0]!;
      const curfewMinute = parts[1]!;
      const returnHour = context.expectedReturnAt.getHours();
      const returnMinute = context.expectedReturnAt.getMinutes();

      if (
        returnHour > curfewHour ||
        (returnHour === curfewHour && returnMinute > curfewMinute)
      ) {
        return `${policy.name}: Expected return after curfew ${latestReturnTime}`;
      }
      return null;
    }

    case "MAX_EXTENSION_COUNT": {
      const maxExtensionCount = (policy.config as { maxExtensionCount?: number })
        .maxExtensionCount;
      const effectiveMax = maxExtensionCount ?? context.leaveType.maxExtensionCount;
      if (
        effectiveMax != null &&
        context.extensionCount != null &&
        context.extensionCount >= effectiveMax
      ) {
        return `${policy.name}: Maximum ${effectiveMax} extensions allowed`;
      }
      return null;
    }

    case "FORM_FIELD_RESTRICTION": {
      const restrictions = (policy.config as { fieldRestrictions?: Array<{ fieldKey: string; disallowedValues?: string[]; patterns?: Array<{ regex: string; message: string }> }> }).fieldRestrictions;
      if (!restrictions?.length || !context.submittedForm) return null;

      for (const restriction of restrictions) {
        const value = context.submittedForm[restriction.fieldKey];
        if (!value || typeof value !== "string") continue;

        if (restriction.disallowedValues?.includes(value)) {
          return `${policy.name}: Value "${value}" is not allowed for this field`;
        }

        if (restriction.patterns) {
          for (const pattern of restriction.patterns) {
            try {
              if (new RegExp(pattern.regex).test(value)) {
                return `${policy.name}: ${pattern.message}`;
              }
            } catch {
              // Skip invalid regex
            }
          }
        }
      }
      return null;
    }

    default:
      return null;
  }
}

async function evaluateBlockDuringPeriod(
  policy: Policy,
  context: PolicyEvaluationContext,
  dbClient: PolicyDbClient,
): Promise<string | null> {
  const blockedPeriods = (policy.config as { blockedPeriods?: string[] })
    .blockedPeriods;
  if (!blockedPeriods?.length || !context.startAt || !context.endAt) {
    return null;
  }

  const overlappingPeriods = await operationalPeriodRepository.findOverlapping(
    blockedPeriods,
    context.startAt,
    context.endAt,
    context.hostelId ?? null,
    dbClient
  );

  if (overlappingPeriods.length > 0) {
    return `${policy.name}: Leave dates overlap with blocked period`;
  }

  return null;
}

export const policyEngine = {
  async evaluate(
    context: PolicyEvaluationContext,
    dbClient: PolicyDbClient = db
  ): Promise<PolicyResult> {
    const activePolicies = await policyRepository.findActiveByLeaveTypeId(
      context.leaveType.id,
      context.hostelId ?? null,
      new Date(),
      dbClient,
      {
        studentDepartmentId: context.studentDepartmentId ?? null,
        studentBatchYear: context.studentBatchYear ?? null,
      }
    );

    const restrictions: string[] = [];
    const requirements: string[] = [];

    for (const policy of activePolicies) {
      if (policy.policyType === "REQUIRE_PARENT_APPROVAL") {
        requirements.push(`${policy.name}: Parent approval required`);
        continue;
      }
      let restriction: string | null = null;

      if (policy.policyType === "BLOCK_DURING_PERIOD") {
        restriction = await evaluateBlockDuringPeriod(
          policy,
          context,
          dbClient
        );
      } else {
        restriction = evaluatePolicy(policy, context);
      }

      if (restriction) {
        restrictions.push(restriction);
      }
    }

    return {
      allowed: restrictions.length === 0,
      workflowId: context.leaveType.defaultWorkflowId,
      restrictions,
      requirements,
    };
  },
};

