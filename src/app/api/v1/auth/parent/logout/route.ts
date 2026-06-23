import { ApiResponse } from "@/lib/api/response";
import { PARENT_JWT_COOKIE } from "@/lib/jwt";

export async function POST() {
  try {
    const response = ApiResponse.success({ loggedOut: true });

    response.headers.set(
      "Set-Cookie",
      `${PARENT_JWT_COOKIE}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`
    );

    return response;
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
