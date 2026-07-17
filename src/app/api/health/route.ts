import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sql } from "drizzle-orm";

export async function GET() {
  const checks: Record<string, string> = {};

  checks.status = "ok";
  checks.timestamp = new Date().toISOString();
  checks.version = process.env.npm_package_version ?? "0.1.0";
  checks.environment = process.env.NODE_ENV ?? "development";

  try {
    await db.execute(sql`SELECT 1`);
    checks.database = "connected";
  } catch (error) {
    checks.database = "error";
    checks.status = "degraded";
    logger.error("Health check: database connection failed", { error });
  }

  const clerkKey = process.env.CLERK_SECRET_KEY;
  checks.clerk = clerkKey?.startsWith("sk_test_") || clerkKey?.startsWith("sk_live_") ? "configured" : "missing";

  const msg91Key = process.env.MSG91_AUTH_KEY;
  checks.msg91 = msg91Key ? "configured" : "missing";

  const resendKey = process.env.RESEND_API_KEY;
  checks.resend = resendKey ? "configured" : "missing";

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  checks.baseUrl = baseUrl ? baseUrl : "http://localhost:3000";

  const statusCode = checks.status === "ok" ? 200 : 503;

  return Response.json(
    { success: checks.status === "ok", checks },
    { status: statusCode }
  );
}
