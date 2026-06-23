import sendOtpSchema from "@/dto/parent/send-otp.dto";
import { ApiResponse } from "@/lib/api/response";
import { rateLimit } from "@/lib/rate-limiter";
import { sendParentOtp } from "@/services/parent/send-parent-otp.service";

export async function POST(
  request: Request,
  routeContext: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await routeContext.params;

    rateLimit(`approve-send-otp:${token}`, 3, 60_000);

    const body = await request.json();
    const dto = sendOtpSchema.parse(body);

    const result = await sendParentOtp(token, dto.phone);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
