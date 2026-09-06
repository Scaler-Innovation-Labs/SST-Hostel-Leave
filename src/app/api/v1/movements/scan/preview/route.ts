import { scanQrPreviewSchema } from "@/dto/movement/scan-qr.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { rateLimit } from "@/lib/rate-limiter";
import { previewQrScan } from "@/services/movement/scan-qr.service";

export async function GET(request: Request) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.GUARD,
      ROLES.POC,
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);

    await rateLimit(`scan:${currentUser.id}`, 120, 60_000);

    const url = new URL(request.url);
    const { token } = scanQrPreviewSchema.parse(Object.fromEntries(url.searchParams));

    const result = await previewQrScan(token);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}