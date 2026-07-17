import { ApiResponse } from "@/lib/api/response";
import { getHealthStatus } from "@/services/health/health.service";

export async function GET() {
  const health = await getHealthStatus();

  const statusCode = health.status === "ok" ? 200 : 503;

  return ApiResponse.success(health, statusCode);
}
