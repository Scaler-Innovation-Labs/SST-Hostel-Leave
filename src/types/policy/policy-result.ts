export type PolicyCheckEntry = {
  key: string;
  label: string;
  passed: boolean;
  message?: string;
};

/** One immutable policy version evaluated for a leave. */
export type PolicyEvaluationRecord = {
  policyId: string;
  policyVersionId: string | null;
  passed: boolean;
  message: string | null;
  /** Resolved request inputs the evaluation was computed from.
      Optional — never the full policy definition. */
  inputs?: Record<string, unknown> | null;
};

export type PolicyResult = {
  allowed: boolean;

  workflowId: string | null;

  restrictions: string[];

  requirements: string[];

  checks: PolicyCheckEntry[];

  /** Per-policy evaluation records for the leave execution context. */
  evaluations: PolicyEvaluationRecord[];
};

/** Summary stored in leave_requests.policy_result — small, fast to read. */
export type PolicyResultSummary = {
  allowed: boolean;
  restrictions: string[];
  requirements: string[];
  failedCount: number;
  checks: PolicyCheckEntry[];
};
