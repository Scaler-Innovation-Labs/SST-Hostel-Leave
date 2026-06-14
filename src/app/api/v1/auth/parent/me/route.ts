import { ApiResponse } from "@/lib/api/response";
import { getParentProfile } from "@/services/auth/get-parent-profile.service";

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const profile = await getParentProfile(cookieHeader);

    return ApiResponse.success(profile);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export const runtime = "edge";
