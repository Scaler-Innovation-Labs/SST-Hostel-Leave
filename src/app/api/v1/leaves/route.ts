import createLeaveSchema from "@/dto/leave/create-leave.dto";
import listLeavesSchema from "@/dto/leave/list-leaves.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { createLeave } from "@/services/leave/create-leave.service";
import { listLeaves } from "@/services/leave/list-leaves.service";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.STUDENT,
      ROLES.POC,
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);

    const url = new URL(request.url);
    const query = listLeavesSchema.parse(Object.fromEntries(url.searchParams));

    const result = await listLeaves(query, currentUser);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [ROLES.STUDENT]);

    const body = await request.json();
    const dto = createLeaveSchema.parse(body);

    const result = await createLeave(dto, currentUser);

    return ApiResponse.created(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
