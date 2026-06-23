import listQrPassesSchema from "@/dto/movement/list-qr-passes.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { listQrPasses } from "@/services/movement/list-qr-passes.service";

export async function GET(request: Request) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.STUDENT,
      ROLES.POC,
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);

    const url = new URL(request.url);
    const query = listQrPassesSchema.parse(
      Object.fromEntries(url.searchParams),
    );

    const qrPasses = await listQrPasses(query.leaveRequestId, currentUser);

    return ApiResponse.success(qrPasses);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
