import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

import { OUTBOX_PRE_COMMIT_GRACE_MS } from "@/constants/outbox/outbox-publish";
import { logger } from "@/lib/logger";
import {
  deleteQueueMessage,
  getMaxMessages,
  getVisibilityTimeoutSeconds,
  getWaitTimeSeconds,
  isMalformedMessage,
  type ReceivedQueueMessage,
  receiveQueueMessages,
} from "@/lib/sqs";
import {
  isTerminalOutcome,
  processSingleEvent,
} from "@/services/outbox/outbox-worker.service";

const ERROR_BACKOFF_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function isFreshMessage(message: ReceivedQueueMessage): boolean {
  if (message.sentTimestampMs <= 0) return false;
  return Date.now() - message.sentTimestampMs < OUTBOX_PRE_COMMIT_GRACE_MS;
}

export type PollOnceResult = {
  received: number;
  deleted: number;
  retained: number;
};

/**
 * One long-poll iteration. Exported for tests; the daemon calls it in a
 * loop via `startWorker`.
 *
 * Deletion rule: the SQS message is deleted only for terminal outcomes
 * (see `isTerminalOutcome`). Transient failures and claim races keep the
 * message so SQS redelivers it after the visibility timeout; repeated
 * failures eventually land in the DLQ via the queue redrive policy while
 * the DB row (never purged unless PROCESSED) stays the source of truth.
 * Malformed bodies can never succeed, so they are logged and deleted to
 * avoid a poison loop.
 */
export async function pollOnce(): Promise<PollOnceResult> {
  const result: PollOnceResult = { received: 0, deleted: 0, retained: 0 };

  const messages = await receiveQueueMessages();
  result.received = messages.length;

  for (const message of messages) {
    const deleted = await handleMessage(message);
    if (deleted) {
      result.deleted++;
    } else {
      result.retained++;
    }
  }

  return result;
}

async function handleMessage(
  message: ReceivedQueueMessage,
): Promise<boolean> {
  if (isMalformedMessage(message)) {
    logger.warn("Outbox worker discarded malformed SQS message", {
      messageId: message.messageId,
      receiveCount: message.receiveCount,
    });
    await deleteQueueMessage(message.receiptHandle);
    return true;
  }

  const { eventId, eventType } = message.body;

  try {
    const outcome = await processSingleEvent(eventId);

    if (outcome === "missing" && isFreshMessage(message)) {
      // Pre-commit race: the immediate publish fired milliseconds before
      // the business transaction committed. Retain so redelivery finds
      // the committed row; the grace is far shorter than the 48h purge
      // horizon, so genuinely purged rows still get deleted promptly.
      logger.debug("Outbox worker retained message for uncommitted event", {
        eventId,
        eventType,
        messageId: message.messageId,
        receiveCount: message.receiveCount,
      });
      return false;
    }

    if (outcome === "processed") {
      logger.info("Outbox worker processed event", {
        eventId,
        eventType,
        messageId: message.messageId,
      });
    } else if (outcome !== "skipped-processed") {
      logger.warn("Outbox worker did not process event", {
        eventId,
        eventType,
        outcome,
        messageId: message.messageId,
        receiveCount: message.receiveCount,
      });
    }

    if (isTerminalOutcome(outcome)) {
      await deleteQueueMessage(message.receiptHandle);
      return true;
    }
    return false;
  } catch (error) {
    // Unexpected infra failure (DB down after claim, SQS delete threw,
    // handler threw non-Error through a gap). Never delete: redelivery is
    // the only safe choice. The error itself carries no payload data.
    logger.error("Outbox worker message handling failed", {
      eventId,
      eventType,
      messageId: message.messageId,
      receiveCount: message.receiveCount,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

let running = false;
let activePoll: Promise<PollOnceResult> | null = null;

/** Test-only: observe daemon state. */
export function __isWorkerRunningForTests(): boolean {
  return running;
}

/**
 * Persistent long-poll daemon. Stops receiving on SIGTERM/SIGINT, drains
 * the in-flight poll iteration, then resolves so the process exits cleanly.
 */
export async function startWorker(): Promise<void> {
  if (running) return;
  running = true;

  logger.info("Outbox worker started", {
    waitTimeSeconds: getWaitTimeSeconds(),
    maxMessages: getMaxMessages(),
    visibilityTimeoutSeconds: getVisibilityTimeoutSeconds(),
  });

  const shutdown = async (signal: string): Promise<void> => {
    if (!running) return;
    logger.info("Outbox worker shutting down", { signal });
    running = false;
    try {
      await activePoll;
    } catch {
      // pollOnce never rejects (per-message isolation), but a receive-
      // level throw is possible; shutdown must still complete.
    }
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));

  while (running) {
    try {
      activePoll = pollOnce();
      await activePoll;
    } catch (error) {
      // Receive-level failure (SQS outage, creds, network): back off
      // instead of hot-looping. Claimed DB rows self-heal via lease
      // expiry + requeueStuckProcessing.
      logger.error("Outbox worker poll failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      await sleep(ERROR_BACKOFF_MS);
    } finally {
      activePoll = null;
    }
  }

  logger.info("Outbox worker stopped");
}

// Entry guard: importing this module (e.g. in vitest) must not start the
// daemon. tsx sets argv[1] to the script path on direct execution.
const invokedDirectly =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("outbox-worker.ts") ||
    process.argv[1].endsWith("outbox-worker.js"));

if (invokedDirectly) {
  startWorker().catch((error) => {
    logger.error("Outbox worker crashed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  });
}
