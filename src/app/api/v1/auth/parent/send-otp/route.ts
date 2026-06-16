import parentSendOtpSchema from "@/dto/auth/parent-send-otp.dto";
import { ApiResponse } from "@/lib/api/response";
import { rateLimit } from "@/lib/rate-limiter";
import { parentAuthService } from "@/services/auth/parent-auth.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const dto = parentSendOtpSchema.parse(body);

    rateLimit(`auth-send-otp:${dto.phone}`, 3, 60_000);

    const result = await parentAuthService.sendOtp(dto.phone);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
