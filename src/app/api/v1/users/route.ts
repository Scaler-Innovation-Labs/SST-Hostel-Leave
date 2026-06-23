import createUserSchema from "@/dto/user/create-user.dto";
import listUsersSchema from "@/dto/user/list-users.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { createUser } from "@/services/user/create-user.service";
import { listUsers } from "@/services/user/list-users.service";

export async function GET(request: Request) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const url = new URL(request.url);
    const query = listUsersSchema.parse(Object.fromEntries(url.searchParams));

    const result = await listUsers(query);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const body = await request.json();
    const dto = createUserSchema.parse(body);

    const result = await createUser(dto);

    return ApiResponse.created(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

