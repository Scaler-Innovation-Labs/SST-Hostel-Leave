// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { MockSQSClient, mockSend, mockCtor } = vi.hoisted(() => {
  const mockSendInner = vi.fn();
  const mockCtorInner = vi.fn();
  class MockSQSClientInner {
    constructor(opts: unknown) {
      mockCtorInner(opts);
    }
    send(...args: unknown[]) {
      return mockSendInner(...args);
    }
  }
  return {
    MockSQSClient: MockSQSClientInner,
    mockSend: mockSendInner,
    mockCtor: mockCtorInner,
  };
});

vi.mock("@aws-sdk/client-sqs", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@aws-sdk/client-sqs")>();
  return { ...actual, SQSClient: MockSQSClient };
});

import {
  __resetSqsClientForTests,
  deleteQueueMessage,
  getQueueDepth,
  getQueueUrl,
  isMalformedMessage,
  receiveQueueMessages,
  sendQueueMessage,
} from "@/lib/sqs";

const savedEnv: Record<string, string | undefined> = {};

function saveEnv() {
  for (const key of [
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "OUTBOX_QUEUE_URL",
    "SQS_ENDPOINT_URL",
  ]) {
    savedEnv[key] = process.env[key];
  }
}

function restoreEnv() {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

beforeEach(() => {
  saveEnv();
  vi.clearAllMocks();
  __resetSqsClientForTests();
  process.env.AWS_REGION = "ap-south-1";
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  delete process.env.SQS_ENDPOINT_URL;
  process.env.OUTBOX_QUEUE_URL =
    "https://sqs.ap-south-1.amazonaws.com/123/outbox-dev";
});

afterEach(() => {
  restoreEnv();
  __resetSqsClientForTests();
});

describe("sqs lib", () => {
  it("requires OUTBOX_QUEUE_URL", () => {
    delete process.env.OUTBOX_QUEUE_URL;
    expect(() => getQueueUrl()).toThrow("OUTBOX_QUEUE_URL");
  });

  it("sends the minimal JSON body and returns the message id", async () => {
    mockSend.mockResolvedValue({ MessageId: "mid-1" });

    const messageId = await sendQueueMessage({
      eventId: "evt-1",
      eventType: "LEAVE_APPROVED",
    });

    expect(messageId).toBe("mid-1");
    const command = mockSend.mock.calls[0][0];
    expect(command.input.QueueUrl).toBe(process.env.OUTBOX_QUEUE_URL);
    expect(JSON.parse(command.input.MessageBody)).toEqual({
      eventId: "evt-1",
      eventType: "LEAVE_APPROVED",
    });
  });

  it("omits static credentials so the IAM-role chain applies", async () => {
    mockSend.mockResolvedValue({});

    await sendQueueMessage({ eventId: "e" });

    expect(mockCtor).toHaveBeenCalledTimes(1);
    expect(mockCtor.mock.calls[0][0]).not.toHaveProperty("credentials");
  });

  it("passes SQS_ENDPOINT_URL through only when set (LocalStack/outage sim)", async () => {
    mockSend.mockResolvedValue({});

    process.env.SQS_ENDPOINT_URL = "http://localhost:4566";
    await sendQueueMessage({ eventId: "e" });
    expect(mockCtor.mock.calls[0][0].endpoint).toBe("http://localhost:4566");

    __resetSqsClientForTests();
    mockCtor.mockClear();
    delete process.env.SQS_ENDPOINT_URL;
    await sendQueueMessage({ eventId: "e" });
    expect(mockCtor.mock.calls[0][0]).not.toHaveProperty("endpoint");
  });

  it("maps received messages with counts and timestamps", async () => {
    mockSend.mockResolvedValue({
      Messages: [
        {
          MessageId: "m1",
          ReceiptHandle: "rh1",
          Body: JSON.stringify({ eventId: "evt-1" }),
          Attributes: {
            ApproximateReceiveCount: "3",
            SentTimestamp: "1725600000000",
          },
        },
        // Entries without identity are skipped, not surfaced.
        { Body: "{}" },
      ],
    });

    const messages = await receiveQueueMessages();

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      messageId: "m1",
      receiptHandle: "rh1",
      receiveCount: 3,
      sentTimestampMs: 1725600000000,
    });
    expect(messages[0].body).toEqual({ eventId: "evt-1" });
  });

  it("surfaces unparseable bodies as malformed placeholders", async () => {
    mockSend.mockResolvedValue({
      Messages: [{ MessageId: "m2", ReceiptHandle: "rh2", Body: "not-json" }],
    });

    const messages = await receiveQueueMessages();

    expect(messages).toHaveLength(1);
    expect(isMalformedMessage(messages[0])).toBe(true);
  });

  it("reads queue depth with zero defaults", async () => {
    mockSend.mockResolvedValue({
      Attributes: {
        ApproximateNumberOfMessages: "7",
        ApproximateNumberOfMessagesNotVisible: "2",
      },
    });

    const depth = await getQueueDepth();

    expect(depth).toEqual({ visible: 7, notVisible: 2, delayed: 0 });
    const command = mockSend.mock.calls[0][0];
    expect(command.input.QueueUrl).toBe(process.env.OUTBOX_QUEUE_URL);
  });

  it("deletes by receipt handle", async () => {
    mockSend.mockResolvedValue({});

    await deleteQueueMessage("rh-9");

    const command = mockSend.mock.calls[0][0];
    expect(command.input.ReceiptHandle).toBe("rh-9");
  });
});
