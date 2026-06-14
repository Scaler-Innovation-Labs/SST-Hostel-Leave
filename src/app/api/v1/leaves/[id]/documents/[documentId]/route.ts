import { ApiResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/require-auth";
import { deleteLeaveDocument } from "@/services/leave/documents/delete-document.service";

export async function DELETE(
  _request: Request,
  routeContext: { params: Promise<{ id: string; documentId: string }> },
) {
  try {
    await requireAuth();

    const { documentId } = await routeContext.params;

    await deleteLeaveDocument(documentId);

    return ApiResponse.success({ deleted: true });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
