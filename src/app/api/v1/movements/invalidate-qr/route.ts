import invalidateQrSchema from "@/dto/movement/invalidate-qr.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { invalidateQrPass } from "@/services/movement/invalidate-qr.service";

export async function POST(request: Request) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.POC,
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);

    const body = await request.json();
    const dto = invalidateQrSchema.parse(body);

    const result = await invalidateQrPass({
      qrPassId: dto.qrPassId,
      recordedBy: currentUser.id,
      reason: dto.reason,
    });

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
