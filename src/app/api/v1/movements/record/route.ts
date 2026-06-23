import type { MovementEvent } from "@/constants/movement/movement-event";
import type { MovementMethod } from "@/constants/movement/movement-method";
import type { MovementState } from "@/constants/movement/movement-state";
import recordMovementSchema from "@/dto/movement/record-movement.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { recordMovement } from "@/services/movement/record-movement.service";

export async function POST(request: Request) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.GUARD,
      ROLES.POC,
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);

    const body = await request.json();
    const dto = recordMovementSchema.parse(body);

    const result = await recordMovement({
      ...dto,
      fromState: dto.fromState as MovementState,
      toState: dto.toState as MovementState,
      eventType: dto.eventType as MovementEvent,
      movementMethod: dto.movementMethod as MovementMethod,
      recordedBy: currentUser.id,
      occurredAt: new Date(),
    });

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
