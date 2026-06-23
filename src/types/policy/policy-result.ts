export type PolicyResult = {
  allowed: boolean;

  workflowId: string | null;

  restrictions: string[];

  requirements: string[];
};
