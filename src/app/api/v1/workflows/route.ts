import listWorkflowsSchema from "@/dto/workflow/list-workflows.dto";
import saveWorkflowSchema from "@/dto/workflow/save-workflow.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { listWorkflows } from "@/services/workflow/list-workflows.service";
import { createWorkflow } from "@/services/workflow/save-workflow.service";

export async function GET(request: Request) {
  try {
    requireAnyRole(await requireAuth(), [
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);

    const url = new URL(request.url);
    const query = listWorkflowsSchema.parse(Object.fromEntries(url.searchParams));

    const result = await listWorkflows(query);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);
    const dto = saveWorkflowSchema.parse(await request.json());
    return ApiResponse.created(await createWorkflow(dto));
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export const runtime = "edge";
