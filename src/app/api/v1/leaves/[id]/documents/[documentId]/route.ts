import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { deleteLeaveDocument } from "@/services/leave/documents/delete-document.service";

export async function DELETE(
  _request: Request,
  routeContext: { params: Promise<{ id: string; documentId: string }> },
) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.STUDENT,
      ROLES.ADMIN,
      ROLES.POC,
      ROLES.SUPER_ADMIN,
    ]);

    const { documentId } = await routeContext.params;

    await deleteLeaveDocument(documentId, currentUser);

    return ApiResponse.success({ deleted: true });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
