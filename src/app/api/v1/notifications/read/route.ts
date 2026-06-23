import { markNotificationsReadSchema } from "@/dto/notification/list-notifications.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/require-auth";
import { markNotificationsRead } from "@/services/notification/list-notifications.service";

export async function POST(request: Request) {
  try {
    await requireAuth();

    const body = await request.json();
    const dto = markNotificationsReadSchema.parse(body);

    await markNotificationsRead(dto.ids);

    return ApiResponse.success({ marked: dto.ids.length });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
