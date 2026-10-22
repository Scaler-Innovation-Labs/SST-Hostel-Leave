import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { getStudentContacts } from "@/services/student/get-student-contacts.service";

export async function GET() {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [ROLES.STUDENT]);

    const result = await getStudentContacts(currentUser.id);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
