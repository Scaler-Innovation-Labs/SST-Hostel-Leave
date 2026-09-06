import { uploadDocumentSchema } from "@/dto/leave/upload-document.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { rateLimit } from "@/lib/rate-limiter";
import { listLeaveDocuments } from "@/services/leave/documents/list-documents.service";
import { uploadLeaveDocument } from "@/services/leave/documents/upload-document.service";

export async function GET(
  _request: Request,
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
    const documents = await listLeaveDocuments(id, currentUser);

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

    // 10MB Cloudinary uploads per call: throttle per user.
    await rateLimit(`documents:${currentUser.id}`, 60, 3_600_000);

    const { id } = await routeContext.params;

    const formData = await request.formData();
    const file = formData.get("file");
    const { documentType } = uploadDocumentSchema.parse({
      documentType:
        typeof formData.get("documentType") === "string"
          ? formData.get("documentType")
          : undefined,
    });

    if (!file || !(file instanceof File)) {
      return ApiResponse.error("VALIDATION_ERROR", "File is required", 400);
    }

    const result = await uploadLeaveDocument(id, file, documentType, currentUser.id, currentUser);

    return ApiResponse.created(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
