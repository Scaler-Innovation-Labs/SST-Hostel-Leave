// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mockPostMessage = vi.fn();

vi.mock("@slack/web-api", () => ({
	WebClient: class {
		chat = {
			postMessage: (...args: any[]) => mockPostMessage(...args),
		};
	},
}));

import { createSlackProvider } from "@/services/notification/providers/slack.provider";

beforeEach(() => {
	vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
	vi.stubEnv("SLACK_CHANNEL_ID", "C123");
	mockPostMessage.mockReset();
	mockPostMessage.mockResolvedValue({ ok: true, ts: "456.789" });
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("createSlackProvider", () => {
	it("returns a failure when Slack is not configured", async () => {
		vi.stubEnv("SLACK_BOT_TOKEN", "");
		vi.stubEnv("SLACK_CHANNEL_ID", "");

		const result = await createSlackProvider().send({
			to: "C123",
			subject: "Leave update",
			body: "Your leave was approved.",
		});

		expect(result.success).toBe(false);
		expect(mockPostMessage).not.toHaveBeenCalled();
	});

	it("posts a CC block when mentions are provided", async () => {
		const result = await createSlackProvider().send({
			to: "C123",
			subject: "Leave update",
			body: "Your leave was approved.",
			mentions: ["SADM", "SPOC"],
		});

		expect(result.success).toBe(true);
		expect(mockPostMessage).toHaveBeenCalledTimes(1);

		const { blocks } = mockPostMessage.mock.calls[0][0];
		const ccBlock = blocks.find(
			(block: any) => block.type === "section" && block.text?.text.startsWith("CC:")
		);
		expect(ccBlock).toBeDefined();
		expect(ccBlock.text.text).toBe("CC: <@SADM> <@SPOC>");
	});

	it("does not add a CC block when mentions are empty", async () => {
		await createSlackProvider().send({
			to: "C123",
			subject: "Leave update",
			body: "No group tags here.",
			mentions: [],
		});

		const { blocks } = mockPostMessage.mock.calls[0][0];
		const ccBlock = blocks.find(
			(block: any) => block.type === "section" && block.text?.text.startsWith("CC:")
		);
		expect(ccBlock).toBeUndefined();
	});
});
