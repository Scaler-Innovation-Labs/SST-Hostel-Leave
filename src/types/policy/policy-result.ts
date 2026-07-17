export type PolicyCheckEntry = {
  key: string;
  label: string;
  passed: boolean;
  message?: string;
};

export type PolicyResult = {
  allowed: boolean;

  workflowId: string | null;

  restrictions: string[];

  requirements: string[];

  checks: PolicyCheckEntry[];
};
