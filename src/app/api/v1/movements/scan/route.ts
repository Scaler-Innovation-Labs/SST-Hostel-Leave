import scanQrSchema from "@/dto/movement/scan-qr.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { scanQrPass } from "@/services/movement/scan-qr.service";

export async function POST(request: Request) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.GUARD,
      ROLES.POC,
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);

    const body = await request.json();
    const dto = scanQrSchema.parse(body);

    const result = await scanQrPass({
      ...dto,
      scannedBy: currentUser.id,
    });

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
