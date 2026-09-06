import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

/**
 * Live SQS probe: real DB → publisher → real SQS → receive → cleanup.
 *
 * Prerequisites (do these first, in order):
 *  1. AWS auth: `aws configure sso` + `aws sso login` (local), or an EC2
 *     instance-profile IAM role. Confirm with `aws sts get-caller-identity`.
 *     No static keys needed.
 *  2. `OUTBOX_QUEUE_URL` points at an EMPTY dev queue. The probe refuses to
 *     run against a non-empty queue.
 *  3. The outbox worker is STOPPED (a running worker would race the probe
 *     for its message).
 *  4. Migration 0027 applied (`npx tsx scripts/migrate-0027-outbox-published-at.ts`).
 *
 * The probe inserts one synthetic outbox row, publishes it, receives it
 * back, asserts the minimal body shape, then deletes both the message and
 * the row. Nothing is left behind on success; on failure it cleans up
 * best-effort before exiting non-zero.
 */
import { randomUUID } from "crypto";

type StepResult = { name: string; ok: boolean; detail: string };

const PROBE_EVENT_TYPE = "SQS_LIVE_PROBE";

async function main(): Promise<void> {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");
  const {
    deleteQueueMessage,
    getQueueDepth,
    getQueueUrl,
    receiveQueueMessages,
  } = await import("@/lib/sqs");
  const { outboxRepository } = await import(
    "@/db/repositories/outbox/outbox.repository"
  );
  const { publishOutboxEvent } = await import(
    "@/services/outbox/outbox-publisher.service"
  );

  const steps: StepResult[] = [];
  const pass = (name: string, detail = ""): void => {
    steps.push({ name, ok: true, detail });
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  };
  const fail = (name: string, detail = ""): never => {
    steps.push({ name, ok: false, detail });
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    throw new Error(`probe step failed: ${name} ${detail}`);
  };

  let probeRowId: string | null = null;
  let probeReceipt: string | null = null;

  const cleanup = async (): Promise<void> => {
    if (probeReceipt) {
      try {
        await deleteQueueMessage(probeReceipt);
      } catch {
        // Best-effort.
      }
      probeReceipt = null;
    }
    if (probeRowId) {
      try {
        await db.execute(sql`
          DELETE FROM "outbox_events" WHERE "id" = ${probeRowId};
        `);
      } catch {
        // Best-effort.
      }
      probeRowId = null;
    }
  };

  try {
    console.log("SQS live probe starting...");

    // 1. Config present.
    let queueUrl: string;
    try {
      queueUrl = getQueueUrl();
    } catch {
      fail("config", "OUTBOX_QUEUE_URL is not set");
    }
    pass("config", `queue=${queueUrl!}`);

    // 2. Schema ready (migration 0027).
    const cols = await db.execute(sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'outbox_events' AND column_name = 'published_at';
    `);
    if (cols.rows.length === 0) {
      fail(
        "schema",
        "published_at missing — run scripts/migrate-0027-outbox-published-at.ts first"
      );
    }
    pass("schema", "published_at present");

    // 3. Queue empty (refuse to run against a live queue).
    const before = await getQueueDepth();
    if (before.visible !== 0 || before.notVisible !== 0) {
      fail(
        "queue-empty",
        `visible=${before.visible} notVisible=${before.notVisible} — drain the dev queue first`
      );
    }
    pass("queue-empty");

    // 4. Real DB insert (durable source of truth).
    const probeAggregateId = randomUUID();
    const created = await outboxRepository.create({
      eventType: PROBE_EVENT_TYPE,
      aggregateType: "NOTIFICATION",
      aggregateId: probeAggregateId,
      payload: { probe: true },
      status: "PENDING",
      attemptCount: 0,
    });
    if (!created) fail("db-insert", "repository returned null");
    probeRowId = created!.id;
    pass("db-insert", `eventId=${probeRowId}`);

    // 5. Real SQS publish + stamp.
    const published = await publishOutboxEvent({
      id: probeRowId!,
      eventType: PROBE_EVENT_TYPE,
    });
    await outboxRepository.markPublished(probeRowId!);
    if (!published.messageId) fail("sqs-publish", "no message id returned");
    pass("sqs-publish", `messageId=${published.messageId}`);

    // 6. Real SQS receive + body-shape assertion.
    let found: { receiptHandle: string; body: unknown } | null = null;
    for (let attempt = 0; attempt < 3 && !found; attempt++) {
      const messages = await receiveQueueMessages({
        maxMessages: 10,
        waitTimeSeconds: 5,
      });
      const match = messages.find((m) => m.body.eventId === probeRowId);
      if (match) {
        found = { receiptHandle: match.receiptHandle, body: match.body };
        probeReceipt = match.receiptHandle;
      }
    }
    if (!found) fail("sqs-receive", "probe message not received in 15s");
    const keys = Object.keys(found!.body as Record<string, unknown>).sort();
    if (keys.join(",") !== "eventId,eventType") {
      fail("body-shape", `unexpected keys: ${keys.join(",")}`);
    }
    pass("body-shape", `keys=${keys.join(",")}`);

    // 7. Cleanup: delete message + row, confirm drain.
    await cleanup();
    const after = await getQueueDepth();
    if (after.visible !== 0 || after.notVisible !== 0) {
      fail(
        "drain",
        `visible=${after.visible} notVisible=${after.notVisible}`
      );
    }
    pass("drain");

    console.log("SQS live probe: ALL STEPS PASSED");
  } catch (error) {
    await cleanup();
    console.error(
      "SQS live probe FAILED:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  } finally {
    process.exit(process.exitCode ?? 0);
  }
}

void main();
