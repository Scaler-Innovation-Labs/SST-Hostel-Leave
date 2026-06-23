import { ApiResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/require-auth";
import { listLeaveTypes } from "@/services/leave/list-leave-types.service";

export async function GET() {
  try {
    await requireAuth();

    const result = await listLeaveTypes();

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

