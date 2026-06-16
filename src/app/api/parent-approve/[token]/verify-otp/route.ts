import verifyOtpSchema from "@/dto/parent/verify-otp.dto";
import { ApiResponse } from "@/lib/api/response";
import { rateLimit } from "@/lib/rate-limiter";
import { verifyParentOtp } from "@/services/parent/verify-parent-otp.service";

export async function POST(
  request: Request,
  routeContext: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await routeContext.params;

    rateLimit(`approve-verify-otp:${token}`, 5, 900_000);

    const body = await request.json();
    const dto = verifyOtpSchema.parse(body);

    const result = await verifyParentOtp(token, dto.otp);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
