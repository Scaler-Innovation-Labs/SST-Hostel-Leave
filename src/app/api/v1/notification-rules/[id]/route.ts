import saveNotificationRuleSchema from "@/dto/notification/save-notification-rule.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import {
  deleteNotificationRule,
  updateNotificationRule,
} from "@/services/notification/notification-rule.service";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);
    const { id } = await params;
    const dto = saveNotificationRuleSchema.parse(await request.json());
    return ApiResponse.success(await updateNotificationRule(id, null, dto));
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);
    const { id } = await params;
    await deleteNotificationRule(id);
    return ApiResponse.success(null);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export const runtime = "edge";
