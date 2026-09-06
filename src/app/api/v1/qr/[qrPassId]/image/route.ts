import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { NotFoundError } from "@/lib/errors";
import { getQrImage } from "@/services/movement/get-qr-image.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ qrPassId: string }> }
) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.STUDENT,
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);

    const { qrPassId } = await params;
    const { png, contentType, cacheControl } = await getQrImage(
      qrPassId,
      currentUser
    );

    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return ApiResponse.error("QR_PASS_NOT_FOUND", "QR pass not found", 404);
    }
    return ApiResponse.fromError(error);
  }
}
