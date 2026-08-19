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
