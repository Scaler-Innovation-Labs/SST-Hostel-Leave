import parentDecisionSchema from "@/dto/parent/parent-decision.dto";
import { ApiResponse } from "@/lib/api/response";
import { rateLimit } from "@/lib/rate-limiter";
import { parentApproveDecision } from "@/services/parent/parent-approve-decision.service";

export async function POST(
  request: Request,
  routeContext: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await routeContext.params;

    rateLimit(`approve-decision:${token}`, 10, 900_000);

    const body = await request.json();
    const dto = parentDecisionSchema.parse(body);

    const result = await parentApproveDecision(token, dto);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
