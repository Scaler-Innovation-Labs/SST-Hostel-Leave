import {
  roles,
  workflowDefinitions,
  workflowSteps,
} from "@/db";
import type { db } from "@/lib/db";
import { WORKFLOW_STEP_KEY } from "@/constants/workflow/workflow-step-key";

type WorkflowDef = {
  code: string;
  name: string;
};

type WorkflowStep = {
  workflowCode: string;
  stepKey: string;
  stepOrder: number;
  approverRoleCode?: string;
  isParentApproval?: boolean;
  approvalMethod?: string;
};

const WORKFLOW_DEFS: WorkflowDef[] = [
  { code: "RE_EXAM", name: "Re Exam Workflow" },
  { code: "LONG_LEAVE", name: "Long Leave Workflow" },
  { code: "LATE_ENTRY", name: "Late Entry Workflow" },
  { code: "LATE_STAY_COLLEGE", name: "Late Stay At College Workflow" },
  { code: "DIFFERENT_HOSTEL", name: "Staying At Different Hostel Workflow" },
  { code: "HOLIDAY", name: "Holidays Workflow" },
  { code: "INTERNSHIP", name: "Internship Workflow" },
  { code: "MARRIAGE_BEREAVEMENT", name: "Marriage / Relative Expired Workflow" },
];

const WORKFLOW_STEPS: WorkflowStep[] = [
  // ==========================
  // RE EXAM
  // ==========================
  { workflowCode: "RE_EXAM", stepKey: WORKFLOW_STEP_KEY.PARENT_APPROVAL, stepOrder: 1, isParentApproval: true, approvalMethod: "SMS_AND_LINK" },
  { workflowCode: "RE_EXAM", stepKey: WORKFLOW_STEP_KEY.ADMIN_APPROVAL, stepOrder: 2, approverRoleCode: "ADMIN", approvalMethod: "PORTAL" },

  // ==========================
  // LONG LEAVE
  // ==========================
  { workflowCode: "LONG_LEAVE", stepKey: WORKFLOW_STEP_KEY.PARENT_APPROVAL, stepOrder: 1, isParentApproval: true, approvalMethod: "SMS_AND_LINK" },
  { workflowCode: "LONG_LEAVE", stepKey: WORKFLOW_STEP_KEY.ADMIN_APPROVAL, stepOrder: 2, approverRoleCode: "ADMIN", approvalMethod: "PORTAL" },

  // ==========================
  // LATE ENTRY
  // ==========================
  { workflowCode: "LATE_ENTRY", stepKey: WORKFLOW_STEP_KEY.PARENT_APPROVAL, stepOrder: 1, isParentApproval: true, approvalMethod: "SMS_AND_LINK" },
  { workflowCode: "LATE_ENTRY", stepKey: WORKFLOW_STEP_KEY.ADMIN_APPROVAL, stepOrder: 2, approverRoleCode: "ADMIN", approvalMethod: "PORTAL" },

  // ==========================
  // LATE STAY COLLEGE
  // ==========================
  { workflowCode: "LATE_STAY_COLLEGE", stepKey: WORKFLOW_STEP_KEY.POC_APPROVAL, stepOrder: 1, approverRoleCode: "POC", approvalMethod: "PORTAL" },
  { workflowCode: "LATE_STAY_COLLEGE", stepKey: WORKFLOW_STEP_KEY.ADMIN_APPROVAL, stepOrder: 2, approverRoleCode: "ADMIN", approvalMethod: "PORTAL" },

  // ==========================
  // DIFFERENT HOSTEL
  // ==========================
  { workflowCode: "DIFFERENT_HOSTEL", stepKey: WORKFLOW_STEP_KEY.PARENT_APPROVAL, stepOrder: 1, isParentApproval: true, approvalMethod: "SMS_AND_LINK" },
  { workflowCode: "DIFFERENT_HOSTEL", stepKey: WORKFLOW_STEP_KEY.ADMIN_APPROVAL, stepOrder: 2, approverRoleCode: "ADMIN", approvalMethod: "PORTAL" },

  // ==========================
  // HOLIDAY
  // ==========================
  { workflowCode: "HOLIDAY", stepKey: WORKFLOW_STEP_KEY.AUTO_APPROVAL, stepOrder: 1, approvalMethod: "AUTO" },

  // ==========================
  // INTERNSHIP
  // ==========================
  { workflowCode: "INTERNSHIP", stepKey: WORKFLOW_STEP_KEY.PARENT_APPROVAL, stepOrder: 1, isParentApproval: true, approvalMethod: "SMS_AND_LINK" },
  { workflowCode: "INTERNSHIP", stepKey: WORKFLOW_STEP_KEY.POC_APPROVAL, stepOrder: 2, approverRoleCode: "POC", approvalMethod: "PORTAL" },
  { workflowCode: "INTERNSHIP", stepKey: WORKFLOW_STEP_KEY.ADMIN_APPROVAL, stepOrder: 3, approverRoleCode: "ADMIN", approvalMethod: "PORTAL" },

  // ==========================
  // MARRIAGE BEREAVEMENT
  // ==========================
  { workflowCode: "MARRIAGE_BEREAVEMENT", stepKey: WORKFLOW_STEP_KEY.PARENT_APPROVAL, stepOrder: 1, isParentApproval: true, approvalMethod: "SMS_AND_LINK" },
  { workflowCode: "MARRIAGE_BEREAVEMENT", stepKey: WORKFLOW_STEP_KEY.POC_APPROVAL, stepOrder: 2, approverRoleCode: "POC", approvalMethod: "PORTAL" },
  { workflowCode: "MARRIAGE_BEREAVEMENT", stepKey: WORKFLOW_STEP_KEY.ADMIN_APPROVAL, stepOrder: 3, approverRoleCode: "ADMIN", approvalMethod: "PORTAL" },
];

export async function seedWorkflows(
  database: typeof db
) {
  const roleRows = await database
    .select()
    .from(roles);

  const roleMap = new Map(
    roleRows.map((role) => [
      role.code,
      role.id,
    ])
  );

  await database
    .insert(workflowDefinitions)
    .values(WORKFLOW_DEFS)
    .onConflictDoNothing();

  const definitions =
    await database
      .select()
      .from(workflowDefinitions);

  const workflowMap = new Map(
    definitions.map((workflow) => [
      workflow.code,
      workflow.id,
    ])
  );

  const steps = WORKFLOW_STEPS.map((step) => ({
    workflowDefinitionId:
      workflowMap.get(
        step.workflowCode
      )!,
    stepKey: step.stepKey,
    stepOrder: step.stepOrder,
    approverRoleId: step.approverRoleCode
      ? roleMap.get(step.approverRoleCode)
      : null,
    isParentApproval: step.isParentApproval ?? false,
    approvalMethod: step.approvalMethod as "SMS_REPLY" | "SMS_AND_LINK" | "SMS_LINK" | "PORTAL" | "AUTO" | undefined,
  }));

  await database
    .insert(workflowSteps)
    .values(steps)
    .onConflictDoNothing();
}
