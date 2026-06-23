import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { listLeaveDocuments } from "@/services/leave/documents/list-documents.service";
import { uploadLeaveDocument } from "@/services/leave/documents/upload-document.service";

export async function GET(
  _request: Request,
  routeContext: { params: Promise<{ id: string }> },
) {
  try {
    requireAnyRole(await requireAuth(), [
      ROLES.STUDENT,
      ROLES.ADMIN,
      ROLES.POC,
      ROLES.SUPER_ADMIN,
    ]);

    const { id } = await routeContext.params;
    const documents = await listLeaveDocuments(id);

    return ApiResponse.success(documents);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function POST(
  request: Request,
  routeContext: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.STUDENT,
      ROLES.ADMIN,
      ROLES.POC,
      ROLES.SUPER_ADMIN,
    ]);

    const { id } = await routeContext.params;

    const formData = await request.formData();
    const file = formData.get("file");
    const documentType = (formData.get("documentType") as string) ?? "GENERAL";

    if (!file || !(file instanceof File)) {
      return ApiResponse.error("VALIDATION_ERROR", "File is required", 400);
    }

    const result = await uploadLeaveDocument(id, file, documentType, currentUser.id, currentUser);

    return ApiResponse.created(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
