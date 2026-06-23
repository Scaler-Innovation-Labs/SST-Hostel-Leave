import manualReturnSchema from "@/dto/movement/manual-return.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { manualReturn } from "@/services/movement/manual-return.service";

export async function POST(request: Request) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.POC,
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);

    const body = await request.json();
    const dto = manualReturnSchema.parse(body);

    const result = await manualReturn({
      studentId: dto.studentId,
      recordedBy: currentUser.id,
      reason: dto.reason,
    });

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
