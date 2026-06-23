import saveNotificationTemplateSchema from "@/dto/notification/save-notification-template.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { getNotificationTemplateById } from "@/services/notification/list-notification-templates.service";
import { updateNotificationTemplate } from "@/services/notification/update-notification-template.service";
import { deleteNotificationTemplate } from "@/services/notification/delete-notification-template.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);
    const { id } = await params;
    return ApiResponse.success(await getNotificationTemplateById(id));
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);
    const { id } = await params;
    const dto = saveNotificationTemplateSchema.partial().parse(await request.json());
    return ApiResponse.success(await updateNotificationTemplate(id, dto));
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);
    const { id } = await params;
    await deleteNotificationTemplate(id);
    return ApiResponse.success({ deleted: true });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
