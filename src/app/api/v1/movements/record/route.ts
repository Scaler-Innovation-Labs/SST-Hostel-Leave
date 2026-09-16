import recordMovementSchema from "@/dto/movement/record-movement.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { AuthorizationError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limiter";
import { recordMovement } from "@/services/movement/record-movement.service";
import { assertCanAccessStudent } from "@/services/shared/authorization.service";

export async function POST(request: Request) {
  try {
    // Raw override recorder: staff-only. Guards scan through
    // /api/v1/movements/scan — this endpoint must not let a guard forge
    // movements for arbitrary students.
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.POC,
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);

    // Keep this defense in depth even though requireAnyRole rejects guards:
    // the raw recorder must never accept a guard if an authorization adapter
    // is misconfigured. Guards use the constrained scan/manual endpoints.
    if (currentUser.roles.includes(ROLES.GUARD)) {
      throw new AuthorizationError("Guards cannot use the raw movement recorder");
    }

    await rateLimit(`movement-write:${currentUser.id}`, 60, 60_000);

    const body = await request.json();
    const dto = recordMovementSchema.parse(body);

    // Hostel-scope guard: scoped staff may only record movements for
    // students in their own hostels.
    await assertCanAccessStudent(currentUser, dto.studentId);

    const result = await recordMovement({
      ...dto,
      recordedBy: currentUser.id,
      occurredAt: new Date(),
    });

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
