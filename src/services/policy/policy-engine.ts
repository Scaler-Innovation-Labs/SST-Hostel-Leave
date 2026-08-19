import { operationalPeriodRepository } from "@/db/repositories/policy/operational-period.repository";
import type { Policy } from "@/db/repositories/policy/policy.repository";
import { policyRepository } from "@/db/repositories/policy/policy.repository";
import { db } from "@/lib/db";
import { policyVersionService } from "@/services/policy/policy-version.service";
import type { PolicyCheckEntry, PolicyEvaluationRecord, PolicyResult } from "@/types/policy/policy-result";

// The curfew window is expressed in IST wall-clock time (e.g. "23:00").
// Server timezones vary (UTC on Vercel), so extract the local hour/minute in
// Asia/Kolkata instead of relying on the server's own timezone offset.
const IST_HOUR_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function getIstHourMinute(date: Date): { hour: number; minute: number } {
  const parts = IST_HOUR_FORMATTER.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { hour, minute };
}

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
  extensionCount?: number;
  hostelId?: string | null;
  studentDepartmentId?: string | null;
  submittedForm?: Record<string, unknown>;
};

type PolicyDbClient = Pick<typeof db, "select" | "insert">;

function evaluatePolicy(
  policy: Policy,
  context: PolicyEvaluationContext
): string | null {
  const config = policy.config as Record<string, unknown>;
  const ruleType = config.type as string | undefined;

  switch (policy.policyType) {
    case "LIMIT": {
      if (ruleType === "MAX_DAYS") {
        const maxDays = config.maxDays as number | undefined;
        if (
          maxDays != null &&
          context.leaveDurationDays != null &&
          context.leaveDurationDays > maxDays
        ) {
          return `${policy.name}: Max ${maxDays} days allowed`;
        }
        return null;
      }

      if (ruleType === "MAX_EXTENSION_COUNT") {
        const maxExtensionCount = config.maxExtensionCount as number | undefined;
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
      return null;
    }

    case "ELIGIBILITY": {
      if (ruleType === "BATCH_RESTRICTION") {
        const blockedBatchYears = config.blockedBatchYears as number[] | undefined;
        if (
          blockedBatchYears?.length &&
          context.studentBatchYear != null &&
          blockedBatchYears.includes(context.studentBatchYear)
        ) {
          return `${policy.name}: Batch ${context.studentBatchYear} is restricted`;
        }
        return null;
      }
      return null;
    }

    case "TIME_WINDOW": {
      if (ruleType === "CURFEW") {
        const latestReturnTime = config.latestReturnTime as string | undefined;
        if (!latestReturnTime || !context.endAt) {
          return null;
        }

        const parts = latestReturnTime.split(":").map(Number);
        if (parts.length !== 2 || parts.some(isNaN)) {
          return null;
        }
        const curfewHour = parts[0]!;
        const curfewMinute = parts[1]!;
        // Compare in IST, not server-local time — on Vercel the runtime is
        // UTC, so getHours() would misjudge every curfew by 5:30.
        const { hour: returnHour, minute: returnMinute } =
          getIstHourMinute(context.endAt);

        if (
          returnHour > curfewHour ||
          (returnHour === curfewHour && returnMinute > curfewMinute)
        ) {
          return `${policy.name}: Expected return after curfew ${latestReturnTime}`;
        }
        return null;
      }

      if (ruleType === "LEAVE_EXPIRY") {
        return null;
      }
      return null;
    }

    case "FORM_VALIDATION": {
      if (ruleType === "FIELD_RESTRICTION") {
        const restrictions = config.fieldRestrictions as Array<{ fieldKey: string; disallowedValues?: string[]; patterns?: Array<{ regex: string; message: string }> }> | undefined;
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

      if (ruleType === "WITHIN_DAYS") {
        const maxDays = config.maxDays as number | undefined;
        if (!maxDays || !context.submittedForm) return null;

        const field = config.field as string | undefined;
        if (!field) return null;

        const dateStr = context.submittedForm[field] as string | undefined;
        if (!dateStr) return null;

        const targetDate = new Date(dateStr);
        const now = new Date();
        const diffMs = targetDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays > maxDays) {
          const message = (config.message as string) ?? `${field} must be within ${maxDays} days (${diffDays} days away)`;
          return `${policy.name}: ${message}`;
        }
        return null;
      }
      return null;
    }

    case "FEATURE_FLAG":
    case "WORKFLOW":
    case "DOCUMENT_REQUIREMENT":
    case "QR_RULE":
      return null;

    default:
      return null;
  }
}

async function evaluateBlockedPeriod(
  policy: Policy,
  context: PolicyEvaluationContext,
  dbClient: PolicyDbClient,
): Promise<string | null> {
  const config = policy.config as Record<string, unknown>;
  const blockedPeriods = config.blockedPeriods as string[] | undefined;
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

const POLICY_TYPE_LABELS: Record<string, string> = {
  FORM_VALIDATION: "Form Validation",
  ELIGIBILITY: "Eligibility",
  LIMIT: "Limit",
  WORKFLOW: "Workflow",
  DOCUMENT_REQUIREMENT: "Document Requirement",
  QR_RULE: "QR Rule",
  TIME_WINDOW: "Time Window",
  FEATURE_FLAG: "Feature Flag",
};

// The rule parameters + resolved request inputs an evaluation was computed
// from. Persisted on policy_evaluations.config so a policy can be debugged
// years later without guessing; submittedForm stays the source for form facts.
function buildEvaluationConfig(
  policy: Policy,
  context: PolicyEvaluationContext
): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};
  if (context.startAt) inputs.leaveStart = context.startAt.toISOString();
  if (context.endAt) inputs.leaveEnd = context.endAt.toISOString();
  if (context.leaveDurationDays != null) inputs.leaveDurationDays = context.leaveDurationDays;
  if (context.studentBatchYear != null) inputs.studentBatchYear = context.studentBatchYear;
  if (context.extensionCount != null) inputs.extensionCount = context.extensionCount;
  if (context.hostelId) inputs.hostelId = context.hostelId;
  return { rule: policy.config, inputs };
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

    // Resolve the immutable version of each policy evaluated here, so the
    // leave configuration context can point at exactly what was enforced.
    const versionByPolicyId = await policyVersionService.getLatestVersions(
      activePolicies.map((policy) => policy.id),
      dbClient
    );

    const restrictions: string[] = [];
    const requirements: string[] = [];
    const checks: PolicyCheckEntry[] = [];
    const evaluations: PolicyEvaluationRecord[] = [];

    const recordEvaluation = (
      policy: Policy,
      passed: boolean,
      message: string | null
    ) => {
      evaluations.push({
        policyId: policy.id,
        policyVersionId: versionByPolicyId.get(policy.id)?.id ?? null,
        passed,
        message,
        config: buildEvaluationConfig(policy, context),
      });
    };

    for (const policy of activePolicies) {
      if (policy.policyType === "ELIGIBILITY" && (policy.config as Record<string, unknown>).type === "PARENT_APPROVAL_REQUIRED") {
        requirements.push(`${policy.name}: Parent approval required`);
        checks.push({
          key: policy.id,
          label: POLICY_TYPE_LABELS[policy.policyType] ?? policy.name,
          passed: true,
          message: "Parent approval required",
        });
        recordEvaluation(policy, true, null);
        continue;
      }

      let restriction: string | null = null;

      if (policy.policyType === "TIME_WINDOW" && (policy.config as Record<string, unknown>).type === "BLOCKED_PERIOD") {
        restriction = await evaluateBlockedPeriod(
          policy,
          context,
          dbClient
        );
      } else {
        restriction = evaluatePolicy(policy, context);
      }

      checks.push({
        key: policy.id,
        label: POLICY_TYPE_LABELS[policy.policyType] ?? policy.name,
        passed: !restriction,
        message: restriction ?? undefined,
      });
      recordEvaluation(policy, !restriction, restriction);

      if (restriction) {
        restrictions.push(restriction);
      }
    }

    return {
      allowed: restrictions.length === 0,
      workflowId: context.leaveType.defaultWorkflowId,
      restrictions,
      requirements,
      checks,
      evaluations,
    };
  },
};

