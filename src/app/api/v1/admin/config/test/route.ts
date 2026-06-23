import testChannelSchema from "@/dto/admin/test-channel.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { testChannel } from "@/services/admin/test-channel.service";

export async function POST(request: Request) {
  try {
    const currentUser = await requireAuth();
    requireAnyRole(currentUser, [ROLES.SUPER_ADMIN]);

    const body = await request.json();
    const dto = testChannelSchema.parse(body);

    const result = await testChannel(dto);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
