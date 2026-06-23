// types/workflow/workflow-step.ts

import type { InferSelectModel } from "drizzle-orm";

import { type workflowSteps } from "@/db/schema/workflow";

export type WorkflowStep =
  InferSelectModel<typeof workflowSteps>;