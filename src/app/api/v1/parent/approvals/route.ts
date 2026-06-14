import { ApiResponse } from "@/lib/api/response";
import { getAuthenticatedParent } from "@/lib/auth/get-authenticated-parent";
import { parentDashboardService } from "@/services/parent/parent-dashboard.service";

export async function GET(request: Request) {
  try {
    const parent = await getAuthenticatedParent(request);
    const approvals = await parentDashboardService.getPendingApprovals(parent.id);

    return ApiResponse.success(approvals);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export const runtime = "edge";
