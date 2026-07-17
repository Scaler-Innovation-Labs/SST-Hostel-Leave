import { saveHostelSchema } from "@/dto/hostel/save-hostel.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { createHostel } from "@/services/hostel/create-hostel.service";
import { listHostels } from "@/services/hostel/list-hostels.service";

export async function GET() {
  try {
    await requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN, ROLES.ADMIN]);
    const rows = await listHostels();
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
