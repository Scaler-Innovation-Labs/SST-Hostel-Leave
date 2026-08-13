import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

dotenvConfig({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { handleLeaveEvent } = await import("@/services/outbox/handlers/leave-event.handler");
  const leaveId = process.argv[2] ?? "dd293514-1d95-450e-b6d2-103af9e30128";
  const result = await handleLeaveEvent({
    id: "manual-replay",
    eventType: "LEAVE_APPROVAL_REQUIRED",
    aggregateType: "LEAVE_REQUEST",
    aggregateId: leaveId,
    payload: { leaveId, studentId: "66185236-f090-4bfc-8d4b-ac8f9227a572", stepKey: "ADMIN_APPROVAL", stepOrder: 2 },
    status: "PENDING",
    attemptCount: 0,
    createdAt: new Date(),
    processedAt: null,
    lastError: null,
  });
  console.log("DONE", JSON.stringify(result));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});