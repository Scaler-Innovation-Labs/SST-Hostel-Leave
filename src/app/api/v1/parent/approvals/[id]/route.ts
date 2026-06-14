import { z } from "zod";

import { ApiResponse } from "@/lib/api/response";
import { getAuthenticatedParent } from "@/lib/auth/get-authenticated-parent";
import { parentDashboardService } from "@/services/parent/parent-dashboard.service";

const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  comments: z.string().max(500).optional(),
});

export async function GET(
  request: Request,
  routeContext: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await routeContext.params;
    const parent = await getAuthenticatedParent(request);
    const approval = await parentDashboardService.getApprovalDetail(id, parent.id);

    return ApiResponse.success(approval);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function POST(
  request: Request,
  routeContext: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await routeContext.params;
    const parent = await getAuthenticatedParent(request);

    const body = await request.json();
    const dto = decisionSchema.parse(body);

    const result = await parentDashboardService.submitDecision(
      id,
      parent.id,
      dto.decision,
      dto.comments
    );

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export const runtime = "edge";
