import {
  leaveTypes,
  workflowDefinitions,
} from "@/db";
import type { db } from "@/lib/db";

export async function seedLeaveTypes(
  database: typeof db
) {
  const workflows =
    await database
      .select()
      .from(workflowDefinitions);

  const workflowMap = new Map(
    workflows.map((workflow) => [
      workflow.code,
      workflow.id,
    ])
  );

  await database
    .insert(leaveTypes)
    .values([
      {
        code: "HOME_PASS",

        name: "Home Pass",

        category: "HOME_PASS",

        workflowMode:
          "HOSTEL",

        defaultWorkflowId:
          workflowMap.get(
            "HOME_PASS_SIMPLE"
          ),

        allowExtensions: true,

        maxExtensionCount: 2,

        formSchema: {
          fields: [
            { key: "destination", label: "Destination", type: "text", required: true, minLength: 2, maxLength: 200 },
            { key: "address", label: "Address during leave", type: "textarea", required: true, minLength: 10, maxLength: 500 },
            { key: "contactNumber", label: "Emergency contact number", type: "tel", required: true, minLength: 10, maxLength: 15 },
          ],
        },
      },

      {
        code: "MEDICAL",

        name: "Medical Leave",

        category: "MEDICAL",

        workflowMode:
          "HOSTEL",

        defaultWorkflowId:
          workflowMap.get(
            "MEDICAL_STANDARD"
          ),

        allowExtensions: true,

        maxExtensionCount: 5,

        formSchema: {
          fields: [
            { key: "hospital", label: "Hospital or clinic", type: "text", required: true, maxLength: 200 },
            { key: "doctorName", label: "Doctor name", type: "text", required: false, maxLength: 200 },
            { key: "medicalReason", label: "Medical details", type: "textarea", required: true, minLength: 10, maxLength: 1000 },
          ],
        },
      },

      {
        code: "LOCAL_OUTING",

        name: "Local Outing",

        category:
          "LOCAL_OUTING",

        workflowMode:
          "HOSTEL",

        defaultWorkflowId:
          workflowMap.get(
            "LOCAL_OUTING_STANDARD"
          ),

        allowExtensions: false,

        formSchema: {
          fields: [
            { key: "destination", label: "Destination", type: "text", required: true, maxLength: 200 },
            { key: "purpose", label: "Purpose", type: "textarea", required: true, minLength: 5, maxLength: 500 },
          ],
        },
      },

      {
        code: "NIGHT_OUT",

        name: "Night Out",

        category: "NIGHT_OUT",

        workflowMode:
          "HOSTEL",

        defaultWorkflowId:
          workflowMap.get(
            "NIGHT_OUT_STANDARD"
          ),

        allowExtensions: false,

        formSchema: {
          fields: [
            { key: "destination", label: "Destination", type: "text", required: true, maxLength: 200 },
            { key: "overnightContact", label: "Overnight contact number", type: "tel", required: true, minLength: 10, maxLength: 15 },
          ],
        },
      },
    ])
    .onConflictDoNothing();
}
