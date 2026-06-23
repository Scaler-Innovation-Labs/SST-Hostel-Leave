import parentVerifySchema from "@/dto/auth/parent-verify.dto";
import { ApiResponse } from "@/lib/api/response";
import { PARENT_JWT_COOKIE, PARENT_JWT_EXPIRY_SECONDS } from "@/lib/jwt";
import { rateLimit } from "@/lib/rate-limiter";
import { parentAuthService } from "@/services/auth/parent-auth.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const dto = parentVerifySchema.parse(body);

    rateLimit(`verify-otp:${dto.phone}`, 5, 900_000);

    const result = await parentAuthService.verifyOtp(dto.phone, dto.otp);

    const response = ApiResponse.success(result);

    response.headers.set(
      "Set-Cookie",
      `${PARENT_JWT_COOKIE}=${result.token}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${PARENT_JWT_EXPIRY_SECONDS}`
    );

    return response;
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
