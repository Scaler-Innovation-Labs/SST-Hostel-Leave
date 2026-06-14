import { listNotificationLogsSchema } from "@/dto/notification/list-notification-logs.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { listNotificationLogs } from "@/services/notification/list-notification-logs.service";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.ADMIN, ROLES.SUPER_ADMIN]);

    const url = new URL(request.url);
    const query = listNotificationLogsSchema.parse(Object.fromEntries(url.searchParams));

    const result = await listNotificationLogs(query);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
