import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  type Message,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

let sqsClient: SQSClient | null = null;

function getSqsClient(): SQSClient {
  if (sqsClient) return sqsClient;

  const region = process.env.AWS_REGION;
  if (!region) {
    throw new Error(
      "SQS is not configured. Set AWS_REGION and OUTBOX_QUEUE_URL.",
    );
  }

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const endpoint = process.env.SQS_ENDPOINT_URL;

  sqsClient = new SQSClient({
    region,
    // Omit static credentials when unset so the SDK default chain applies
    // (EC2 instance profile / IAM role, `aws sso login`). Mirrors s3.ts.
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
    // Set ONLY for LocalStack or failure simulation (connection-refused
    // outage tests). Unset for real AWS.
    ...(endpoint ? { endpoint } : {}),
  });

  return sqsClient;
}

export function getQueueUrl(): string {
  const queueUrl = process.env.OUTBOX_QUEUE_URL;
  if (!queueUrl) {
    throw new Error("SQS is not configured. Set OUTBOX_QUEUE_URL.");
  }
  return queueUrl;
}

function getPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getWaitTimeSeconds(): number {
  // Long polling: 20s keeps the receive loop quiet while staying near-RT.
  return getPositiveIntEnv("SQS_WAIT_TIME_SECONDS", 20);
}

export function getMaxMessages(): number {
  // SQS caps a single receive at 10.
  return Math.min(getPositiveIntEnv("SQS_MAX_MESSAGES", 10), 10);
}

export function getVisibilityTimeoutSeconds(): number {
  // Must exceed the slowest handler's p99. The queue-level redrive/DLQ
  // policy in AWS should match or exceed this value.
  return getPositiveIntEnv("SQS_VISIBILITY_TIMEOUT_SECONDS", 120);
}

/**
 * Minimal queue payload. The durable event (and any sensitive content such
 * as bearer links or tokens) stays in the Postgres outbox row — the worker
 * re-loads it by id. Never extend this shape with payload data.
 */
export type OutboxQueueMessage = {
  eventId: string;
  eventType?: string;
};

export type ReceivedQueueMessage = {
  messageId: string;
  receiptHandle: string;
  body: OutboxQueueMessage;
  receiveCount: number;
  /**
   * SQS send timestamp (ms epoch). Used to distinguish "row committed
   * milliseconds after the immediate publish" (retain briefly) from
   * "purged/never-existed row" (delete). 0 when unavailable.
   */
  sentTimestampMs: number;
};

function parseMessageBody(raw: string | undefined): OutboxQueueMessage | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as { eventId?: unknown }).eventId === "string" &&
      (parsed as { eventId: string }).eventId.length > 0
    ) {
      const eventType = (parsed as { eventType?: unknown }).eventType;
      return {
        eventId: (parsed as { eventId: string }).eventId,
        ...(typeof eventType === "string" ? { eventType } : {}),
      };
    }
    return null;
  } catch {
    return null;
  }
}

function parseReceiveCount(message: Message): number {
  const raw = message.Attributes?.ApproximateReceiveCount;
  const parsed = raw ? Number.parseInt(raw, 10) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseSentTimestampMs(message: Message): number {
  const raw = message.Attributes?.SentTimestamp;
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export async function sendQueueMessage(
  message: OutboxQueueMessage,
): Promise<string> {
  const client = getSqsClient();
  const queueUrl = getQueueUrl();

  const result = await client.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
    }),
  );

  return result.MessageId ?? "";
}

export async function receiveQueueMessages(
  options: {
    maxMessages?: number;
    waitTimeSeconds?: number;
    visibilityTimeoutSeconds?: number;
  } = {},
): Promise<ReceivedQueueMessage[]> {
  const client = getSqsClient();
  const queueUrl = getQueueUrl();

  const result = await client.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages:
        options.maxMessages ?? getMaxMessages(),
      WaitTimeSeconds: options.waitTimeSeconds ?? getWaitTimeSeconds(),
      VisibilityTimeout:
        options.visibilityTimeoutSeconds ?? getVisibilityTimeoutSeconds(),
      MessageSystemAttributeNames: [
        "ApproximateReceiveCount",
        "SentTimestamp",
      ],
    }),
  );

  const messages: ReceivedQueueMessage[] = [];
  for (const message of result.Messages ?? []) {
    if (!message.MessageId || !message.ReceiptHandle) continue;
    const body = parseMessageBody(message.Body);
    // Malformed bodies are surfaced (not dropped) so the worker can log
    // and delete them instead of poison-looping forever.
    messages.push({
      messageId: message.MessageId,
      receiptHandle: message.ReceiptHandle,
      body: body ?? { eventId: "" },
      receiveCount: parseReceiveCount(message),
      sentTimestampMs: parseSentTimestampMs(message),
    });
  }
  return messages;
}

export function isMalformedMessage(message: ReceivedQueueMessage): boolean {
  return message.body.eventId.length === 0;
}

export async function deleteQueueMessage(
  receiptHandle: string,
): Promise<void> {
  const client = getSqsClient();
  const queueUrl = getQueueUrl();

  await client.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
    }),
  );
}

export async function changeMessageVisibility(
  receiptHandle: string,
  visibilityTimeoutSeconds: number,
): Promise<void> {
  const client = getSqsClient();
  const queueUrl = getQueueUrl();

  await client.send(
    new ChangeMessageVisibilityCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
      VisibilityTimeout: visibilityTimeoutSeconds,
    }),
  );
}

export type QueueDepth = {
  visible: number;
  notVisible: number;
  delayed: number;
};

/**
 * Approximate queue depth for verification tooling and ops checks
 * (pre-flight emptiness, post-run drain, DLQ growth). Counts are
 * eventually consistent — treat small staleness as normal.
 */
export async function getQueueDepth(
  queueUrl: string = getQueueUrl(),
): Promise<QueueDepth> {
  const client = getSqsClient();

  const result = await client.send(
    new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: [
        "ApproximateNumberOfMessages",
        "ApproximateNumberOfMessagesNotVisible",
        "ApproximateNumberOfMessagesDelayed",
      ],
    }),
  );

  const parse = (value: string | undefined): number => {
    const parsed = value ? Number.parseInt(value, 10) : 0;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };

  return {
    visible: parse(result.Attributes?.ApproximateNumberOfMessages),
    notVisible: parse(
      result.Attributes?.ApproximateNumberOfMessagesNotVisible
    ),
    delayed: parse(result.Attributes?.ApproximateNumberOfMessagesDelayed),
  };
}

/** Test-only: reset the cached client between tests. */
export function __resetSqsClientForTests(): void {
  sqsClient = null;
}
