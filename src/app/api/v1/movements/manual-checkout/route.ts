import manualCheckoutSchema from "@/dto/movement/manual-checkout.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { rateLimit } from "@/lib/rate-limiter";
import { manualCheckout } from "@/services/movement/manual-checkout.service";

export async function POST(request: Request) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);

    await rateLimit(`movement-write:${currentUser.id}`, 60, 60_000);

    const body = await request.json();
    const dto = manualCheckoutSchema.parse(body);

    const result = await manualCheckout({
      studentId: dto.studentId,
      currentUser,
      reason: dto.reason,
    });

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
