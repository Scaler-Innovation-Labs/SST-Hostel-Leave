import saveNotificationRuleSchema from "@/dto/notification/save-notification-rule.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import {
  createNotificationRule,
  getGlobalRules,
} from "@/services/notification/notification-rule.service";

export async function GET() {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);
    return ApiResponse.success(await getGlobalRules());
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);
    const dto = saveNotificationRuleSchema.parse(await request.json());
    return ApiResponse.success(await createNotificationRule(null, dto, currentUser.id));
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

