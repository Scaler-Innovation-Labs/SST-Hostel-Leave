import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { listHostels } from "@/services/hostel/list-hostels.service";

export async function GET() {
  try {
    await requireAnyRole(await requireAuth(), [
      ROLES.SUPER_ADMIN,
      ROLES.ADMIN,
    ]);

    const rows = await listHostels();

    return ApiResponse.success(rows);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

