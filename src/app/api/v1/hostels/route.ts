import { saveHostelSchema } from "@/dto/hostel/save-hostel.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { createHostel } from "@/services/hostel/create-hostel.service";
import { listHostels } from "@/services/hostel/list-hostels.service";
import { getScopedHostelIds, isStaffScopeRestricted } from "@/services/shared/authorization.service";

export async function GET() {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.POC]);

    const scopedHostelIds = isStaffScopeRestricted(currentUser)
      ? getScopedHostelIds(currentUser)
      : undefined;
    const rows = scopedHostelIds && scopedHostelIds.length > 0
      ? await listHostels(scopedHostelIds)
      : await listHostels();

    return ApiResponse.success(rows);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    requireAnyRole(user, [ROLES.SUPER_ADMIN]);
    const dto = saveHostelSchema.parse(await request.json());
    const hostel = await createHostel(dto, user);
    return ApiResponse.created(hostel);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
