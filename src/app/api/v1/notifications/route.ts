import { listNotificationsSchema } from "@/dto/notification/list-notifications.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/require-auth";
import { listNotifications } from "@/services/notification/list-notifications.service";

export async function GET(request: Request) {
  try {
    const currentUser = await requireAuth();

    const url = new URL(request.url);
    const query = listNotificationsSchema.parse(
      Object.fromEntries(url.searchParams),
    );

    const result = await listNotifications(
      currentUser.id,
      query.page,
      query.limit,
    );

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export const runtime = "edge";
