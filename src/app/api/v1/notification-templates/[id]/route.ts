import { saveNotificationTemplateSchema } from "@/dto/notification/save-notification-template.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { updateNotificationTemplate } from "@/services/notification/update-notification-template.service";
import { deleteNotificationTemplate } from "@/services/notification/delete-notification-template.service";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const { id } = await params;
    const body = await request.json();
    const dto = saveNotificationTemplateSchema.partial().parse(body);
    const template = await updateNotificationTemplate(id, dto);

    return ApiResponse.success(template);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const { id } = await params;
    const result = await deleteNotificationTemplate(id);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export const runtime = "edge";
