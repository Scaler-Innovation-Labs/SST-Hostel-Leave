import markOverdueSchema from "@/dto/movement/mark-overdue.dto";
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
    ]);

    const body = await request.json();
    const dto = markOverdueSchema.parse(body);

    const result = await markOverdue({
      studentId: dto.studentId,
      recordedBy: currentUser.id,
    });

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
