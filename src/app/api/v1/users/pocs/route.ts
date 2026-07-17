import { ApiResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/require-auth";
import { listUsers } from "@/services/user/list-users.service";

export async function GET() {
  try {
    await requireAuth();

    const result = await listUsers({
      page: 1,
      limit: 200,
      role: "POC",
      isActive: undefined,
      sortOrder: "desc",
    });

    const items = result.items.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
    }));

    return ApiResponse.success(items);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
