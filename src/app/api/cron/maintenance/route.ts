import { runExpireLeavesJob } from "@/services/cron/expire-leaves.job";
import { runMarkOverdueJob } from "@/services/cron/mark-overdue.job";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const expireResult = await runExpireLeavesJob();
    const overdueResult = await runMarkOverdueJob();

    return Response.json({
      success: true,
      results: [expireResult, overdueResult],
    }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
