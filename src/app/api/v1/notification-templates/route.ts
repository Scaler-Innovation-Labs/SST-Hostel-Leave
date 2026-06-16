import { saveNotificationTemplateSchema } from "@/dto/notification/save-notification-template.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { listNotificationTemplates } from "@/services/notification/list-notification-templates.service";
import { saveNotificationTemplate } from "@/services/notification/save-notification-template.service";

export async function GET() {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const templates = await listNotificationTemplates();

    return ApiResponse.success(templates);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const body = await request.json();
    const dto = saveNotificationTemplateSchema.parse(body);

    const template = await saveNotificationTemplate(dto);

    return ApiResponse.created(template);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

