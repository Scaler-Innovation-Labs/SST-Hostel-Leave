import markOverdueSchema from "@/dto/movement/mark-overdue.dto";
import { readBoundedJson } from "@/lib/api/request-body";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { markOverdue } from "@/services/movement/mark-overdue.service";

export async function POST(request: Request) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
      ROLES.GUARD,
    ]);

    const body = await readBoundedJson(request, { allowEmpty: true });
    const dto = markOverdueSchema.parse(body);

    const result = await markOverdue({
      studentId: dto.studentId,
      leaveRequestId: dto.leaveRequestId,
      currentUser,
    });

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
