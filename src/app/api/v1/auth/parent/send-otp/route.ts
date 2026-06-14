import parentSendOtpSchema from "@/dto/auth/parent-send-otp.dto";
import { ApiResponse } from "@/lib/api/response";
import { parentAuthService } from "@/services/auth/parent-auth.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const dto = parentSendOtpSchema.parse(body);

    const result = await parentAuthService.sendOtp(dto.phone);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
