import saveWorkflowSchema from "@/dto/workflow/save-workflow.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { deleteWorkflow } from "@/services/workflow/delete-workflow.service";
import { updateWorkflow } from "@/services/workflow/save-workflow.service";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);
    const { id } = await params;
    const dto = saveWorkflowSchema.parse(await request.json());
    return ApiResponse.success(await updateWorkflow(id, dto));
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);
    const { id } = await params;
    await deleteWorkflow(id);
    return ApiResponse.success(null);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export const runtime = "edge";
