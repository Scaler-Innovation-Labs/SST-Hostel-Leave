import recordMovementSchema from "@/dto/movement/record-movement.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
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
