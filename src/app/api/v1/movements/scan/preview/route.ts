import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { previewQrScan } from "@/services/movement/scan-qr.service";

export async function GET(request: Request) {
  try {
    requireAnyRole(await requireAuth(), [
      ROLES.GUARD,
      ROLES.POC,
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);

    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token?.trim()) {
      return ApiResponse.error("VALIDATION_ERROR", "token is required", 400);
    }

    const result = await previewQrScan(token.trim());

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}