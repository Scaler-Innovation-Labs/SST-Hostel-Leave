import {
  roles,
  workflowDefinitions,
  workflowSteps,
} from "@/db";
import type { db } from "@/lib/db";

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

  const pocRoleId =
    roleMap.get("POC");

  const adminRoleId =
    roleMap.get("ADMIN");

  if (!pocRoleId || !adminRoleId) {
    throw new Error(
      "Required roles not seeded"
    );
  }

  await database
    .insert(workflowDefinitions)
    .values([
      {
        code: "HOME_PASS_SIMPLE",
        name: "Home Pass Simple Workflow",
      },
      {
        code: "HOME_PASS_EXTENDED",
        name: "Home Pass Extended Workflow",
      },
      {
        code: "MEDICAL_STANDARD",
        name: "Medical Leave Workflow",
      },
      {
        code: "LOCAL_OUTING_STANDARD",
        name: "Local Outing Workflow",
      },
      {
        code: "NIGHT_OUT_STANDARD",
        name: "Night Out Workflow",
      },
    ])
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

  await database
    .insert(workflowSteps)
    .values([
      // ==================================
      // HOME PASS SIMPLE
      // ==================================

      {
        workflowDefinitionId:
          workflowMap.get(
            "HOME_PASS_SIMPLE"
          )!,
        stepKey: "POC_APPROVAL",
        stepOrder: 1,
        approverRoleId:
          pocRoleId,
        approvalMethod: "PORTAL",
      },

      // ==================================
      // HOME PASS EXTENDED
      // ==================================

      {
        workflowDefinitionId:
          workflowMap.get(
            "HOME_PASS_EXTENDED"
          )!,
        stepKey: "POC_APPROVAL",
        stepOrder: 1,
        approverRoleId:
          pocRoleId,
        approvalMethod: "PORTAL",
      },

      {
        workflowDefinitionId:
          workflowMap.get(
            "HOME_PASS_EXTENDED"
          )!,
        stepKey: "ADMIN_APPROVAL",
        stepOrder: 2,
        approverRoleId:
          adminRoleId,
        approvalMethod: "PORTAL",
      },

      // ==================================
      // MEDICAL
      // ==================================

      {
        workflowDefinitionId:
          workflowMap.get(
            "MEDICAL_STANDARD"
          )!,
        stepKey:
          "PARENT_APPROVAL",
        stepOrder: 1,
        isParentApproval: true,
        approvalMethod: "SMS_AND_LINK",
      },

      {
        workflowDefinitionId:
          workflowMap.get(
            "MEDICAL_STANDARD"
          )!,
        stepKey: "POC_APPROVAL",
        stepOrder: 2,
        approverRoleId:
          pocRoleId,
        approvalMethod: "PORTAL",
      },

      {
        workflowDefinitionId:
          workflowMap.get(
            "MEDICAL_STANDARD"
          )!,
        stepKey:
          "ADMIN_APPROVAL",
        stepOrder: 3,
        approverRoleId:
          adminRoleId,
        approvalMethod: "PORTAL",
      },

      // ==================================
      // LOCAL OUTING
      // ==================================

      {
        workflowDefinitionId:
          workflowMap.get(
            "LOCAL_OUTING_STANDARD"
          )!,
        stepKey: "POC_APPROVAL",
        stepOrder: 1,
        approverRoleId:
          pocRoleId,
        approvalMethod: "PORTAL",
      },

      // ==================================
      // NIGHT OUT
      // ==================================

      {
        workflowDefinitionId:
          workflowMap.get(
            "NIGHT_OUT_STANDARD"
          )!,
        stepKey: "POC_APPROVAL",
        stepOrder: 1,
        approverRoleId:
          pocRoleId,
        approvalMethod: "PORTAL",
      },

      {
        workflowDefinitionId:
          workflowMap.get(
            "NIGHT_OUT_STANDARD"
          )!,
        stepKey:
          "ADMIN_APPROVAL",
        stepOrder: 2,
        approverRoleId:
          adminRoleId,
        approvalMethod: "PORTAL",
      },
    ])
    .onConflictDoNothing();
}