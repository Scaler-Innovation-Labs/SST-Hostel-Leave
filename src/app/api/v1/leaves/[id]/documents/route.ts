import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { uploadLeaveDocument } from "@/services/leave/documents/upload-document.service";
import { listLeaveDocuments } from "@/services/leave/documents/list-documents.service";

export async function GET(
  _request: Request,
  routeContext: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();

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
    const file = formData.get("file") as File | null;
    const documentType = (formData.get("documentType") as string) ?? "GENERAL";

    if (!file) {
      return ApiResponse.error("VALIDATION_ERROR", "File is required", 400);
    }

    if (file.size > 10 * 1024 * 1024) {
      return ApiResponse.error("VALIDATION_ERROR", "File size must be less than 10MB", 400);
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      return ApiResponse.error(
        "VALIDATION_ERROR",
        "File type not supported. Allowed: JPG, PNG, GIF, PDF, DOC, DOCX",
        400,
      );
    }

    const result = await uploadLeaveDocument(id, file, documentType, currentUser.id);

    return ApiResponse.created(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
