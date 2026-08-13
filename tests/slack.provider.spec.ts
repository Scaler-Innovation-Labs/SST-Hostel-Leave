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

	it("posts to the channel passed via `to`", async () => {
		const result = await createSlackProvider().send({
			to: "CPOC",
			subject: "POC review",
			body: "A request awaits your review.",
		});

		expect(result.success).toBe(true);
		expect(mockPostMessage).toHaveBeenCalledTimes(1);
		expect(mockPostMessage.mock.calls[0][0].channel).toBe("CPOC");
	});

	it("falls back to the default channel for the legacy sentinel", async () => {
		const result = await createSlackProvider().send({
			to: "slack-channel",
			subject: "Test",
			body: "Settings-page test send.",
		});

		expect(result.success).toBe(true);
		expect(mockPostMessage.mock.calls[0][0].channel).toBe("C123");
	});

	it("posts a CC block when mentions are provided", async () => {
		const result = await createSlackProvider().send({
			to: "C123",
			subject: "Leave update",
			body: "Your leave was approved.",
			mentions: ["UADMIN", "UPOC1"],
		});

		expect(result.success).toBe(true);
		expect(mockPostMessage).toHaveBeenCalledTimes(1);

		const { blocks } = mockPostMessage.mock.calls[0][0];
		const ccBlock = blocks.find(
			(block: any) => block.type === "section" && block.text?.text.startsWith("CC:")
		);
		expect(ccBlock).toBeDefined();
		expect(ccBlock.text.text).toBe("CC: <@UADMIN> <@UPOC1>");
	});

	it("renders usergroup mentions (S...) with subteam syntax", async () => {
		await createSlackProvider().send({
			to: "C123",
			subject: "Leave update",
			body: "Your leave was approved.",
			mentions: ["SVELANKANI-ADMINS", "UUSER1"],
		});

		const { blocks } = mockPostMessage.mock.calls[0][0];
		const ccBlock = blocks.find(
			(block: any) => block.type === "section" && block.text?.text.startsWith("CC:")
		);
		expect(ccBlock.text.text).toBe("CC: <!subteam^SVELANKANI-ADMINS> <@UUSER1>");
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

	it("renders metadata as a bulleted list and skips redundant keys", async () => {
		await createSlackProvider().send({
			to: "C123",
			subject: "Leave update",
			body: "Body with student info and link.",
			metadata: {
				requestNumber: "LR-123",
				dates: "20 Oct 2026",
				reason: "Family event",
				leaveId: "abc-123",
				approvalLink: "https://example.com/approve",
				studentName: "Neerasa",
				rollNumber: "24BCS10005",
				startDate: "20 Oct 2026",
				endDate: "20 Oct 2026",
				empty: "   ",
			},
		});

		const { blocks } = mockPostMessage.mock.calls[0][0];
		const divider = blocks.find((b: any) => b.type === "divider");
		expect(divider).toBeDefined();

		const bulletBlock = blocks.find(
			(b: any) => b.type === "section" && b.text?.text.includes("• *")
		);
		expect(bulletBlock).toBeDefined();
		expect(bulletBlock.text.text).toBe(
			"• *requestNumber:* LR-123\n• *dates:* 20 Oct 2026"
		);
	});

	it("disables link unfurls", async () => {
		await createSlackProvider().send({
			to: "C123",
			subject: "Leave update",
			body: "https://example.com/approve",
		});

		expect(mockPostMessage.mock.calls[0][0].unfurl_links).toBe(false);
		expect(mockPostMessage.mock.calls[0][0].unfurl_media).toBe(false);
	});
});
