import sendOtpSchema from "@/dto/parent/send-otp.dto";
import { ApiResponse } from "@/lib/api/response";
import { sendParentOtp } from "@/services/parent/send-parent-otp.service";

export async function POST(
  request: Request,
  routeContext: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await routeContext.params;

    const body = await request.json();
    const dto = sendOtpSchema.parse(body);

    const result = await sendParentOtp(token, dto.phone);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
