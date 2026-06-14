import generateQrSchema from "@/dto/movement/generate-qr.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { generateQrPass } from "@/services/movement/generate-qr.service";

export async function POST(request: Request) {
  try {
    const currentUser = requireRole(await requireAuth(), ROLES.STUDENT);

    const body = await request.json();
    const dto = generateQrSchema.parse(body);

    const result = await generateQrPass({
      leaveRequestId: dto.leaveRequestId,
      userId: currentUser.id,
      qrType: dto.qrType,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });

    return ApiResponse.created(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
