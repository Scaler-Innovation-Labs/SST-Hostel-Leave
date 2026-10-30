import { GENERIC_PARENT_TOKEN_ERROR_MESSAGE } from "@/constants/parent/parent-approval";
import parentDecisionSchema from "@/dto/parent/parent-decision.dto";
import { readBoundedJson } from "@/lib/api/request-body";
import { ApiResponse } from "@/lib/api/response";
import { sha256 } from "@/lib/crypto";
import { ValidationError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limiter";
import { parentApproveDecision } from "@/services/parent/parent-approve-decision.service";

export async function POST(
  request: Request,
  routeContext: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await routeContext.params;

    if (!token || typeof token !== "string" || !token.trim()) {
      throw new ValidationError(GENERIC_PARENT_TOKEN_ERROR_MESSAGE);
    }

    // Limiter key is the token HASH: the raw token is a bearer credential
    // and must not be persisted in rate_limit_entries.
    await rateLimit(`approve-decision:${await sha256(token.trim())}`, 10, 900_000);

    const body = await readBoundedJson(request);
    const dto = parentDecisionSchema.parse(body);

    const result = await parentApproveDecision(token.trim(), dto);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
