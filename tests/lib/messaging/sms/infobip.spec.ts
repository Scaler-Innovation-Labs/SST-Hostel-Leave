// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getCircuitBreaker } from "@/lib/messaging/circuit-breaker";
import { InfobipSmsProvider } from "@/lib/messaging/sms/infobip";

const BASE_URL = "https://api.test.infobip.com";
const API_KEY = "dGVzdDp0ZXN0";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function acceptedResponse(messageId: string) {
  return jsonResponse({
    messages: [
      {
        messageId,
        status: { groupId: 1, groupName: "PENDING", description: "Message accepted" },
      },
    ],
  });
}

describe("InfobipSmsProvider", () => {
  let provider: InfobipSmsProvider;

  beforeEach(() => {
    provider = new InfobipSmsProvider();
    getCircuitBreaker("infobip-sms").reset();

    vi.stubEnv("INFOBIP_BASE_URL", BASE_URL);
    vi.stubEnv("INFOBIP_API_KEY", API_KEY);
    vi.stubEnv("INFOBIP_SENDER_ID", "Scaler");
    vi.stubEnv("INFOBIP_DLT_CONTENT_TEMPLATE_ID", "1177178583401443872");
    vi.stubEnv("INFOBIP_DLT_PRINCIPAL_ENTITY_ID", "1101527290000039145");
    vi.stubEnv("INFOBIP_CUSTOM_DOMAIN", "");
    vi.stubEnv("SMS_TEST_MODE", "false");
    vi.stubEnv("SMS_TO_NUMBER", "");

    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends SMS with DLT options and URL shortening", async () => {
    vi.mocked(fetch).mockResolvedValue(acceptedResponse("infobip-msg-1"));

    const result = await provider.send({
      to: "+919391541081",
      body: "Dear Parent,John Doe has applied for a Leave. Kindly click the link to review: https://example.com/parent-approve/token -Scaler School of Technology",
    });

    expect(result).toEqual({ success: true, messageId: "infobip-msg-1" });

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/sms/3/messages`);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: `Basic ${API_KEY}`,
      "Content-Type": "application/json",
    });

    const body = JSON.parse(init.body);
    expect(body.messages).toHaveLength(1);

    const message = body.messages[0];
    expect(message.sender).toBe("Scaler");
    expect(message.destinations).toEqual([{ to: "919391541081" }]);
    expect(message.content.text).toContain("https://example.com/parent-approve/token");
    expect(message.options.regional.indiaDlt).toEqual({
      contentTemplateId: "1177178583401443872",
      principalEntityId: "1101527290000039145",
    });
    expect(message.urlOptions).toEqual({ shortenUrl: true, trackClicks: true });
  });

  it("includes customDomain in urlOptions when configured", async () => {
    vi.stubEnv("INFOBIP_CUSTOM_DOMAIN", "scaler.short.gy");
    vi.mocked(fetch).mockResolvedValue(acceptedResponse("infobip-msg-2"));

    await provider.send({
      to: "919391541081",
      body: "Dear Parent,John has applied for a Leave. Kindly click the link to review: https://example.com/parent-approve/token -Scaler School of Technology",
    });

    const init = vi.mocked(fetch).mock.calls[0]![1];
    const body = JSON.parse(init.body);
    expect(body.messages[0].urlOptions).toEqual({
      shortenUrl: true,
      trackClicks: true,
      customDomain: "scaler.short.gy",
    });
  });

  it("redirects destination to test number in test mode without altering the body", async () => {
    vi.stubEnv("SMS_TEST_MODE", "true");
    vi.stubEnv("SMS_TO_NUMBER", "+918520055048");
    vi.mocked(fetch).mockResolvedValue(acceptedResponse("infobip-msg-3"));

    const body =
      "Dear Parent, John has applied for a Leave. Kindly click the link to review: https://example.com/parent-approve/token -Scaler School of Technology";

    await provider.send({ to: "+919391541081", body });

    const init = vi.mocked(fetch).mock.calls[0]![1];
    const parsed = JSON.parse(init.body);
    expect(parsed.messages[0].destinations).toEqual([{ to: "918520055048" }]);
    expect(parsed.messages[0].content.text).toBe(body);
  });

  it("fails fast when the API key is missing", async () => {
    vi.stubEnv("INFOBIP_API_KEY", "");

    const result = await provider.send({ to: "+919391541081", body: "test" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("INFOBIP_API_KEY");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails fast when DLT template IDs are missing", async () => {
    vi.stubEnv("INFOBIP_DLT_CONTENT_TEMPLATE_ID", "");

    const result = await provider.send({ to: "+919391541081", body: "test" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("INFOBIP_DLT_CONTENT_TEMPLATE_ID");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects the message when Infobip returns a non-accepted status group", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        messages: [
          {
            messageId: "infobip-msg-4",
            status: { groupId: 3, groupName: "REJECTED", description: "Rejected by operator" },
          },
        ],
      }),
    );

    const result = await provider.send({ to: "+919391541081", body: "test" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Message rejected: Rejected by operator");
  });

  it("fails without retrying on a non-retryable API error", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(
        { requestError: { serviceException: { text: "Invalid sender" } } },
        400,
      ),
    );

    const result = await provider.send({ to: "+919391541081", body: "test" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Infobip API error (400): Invalid sender");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries on retryable API errors and surfaces the final failure", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(
        { requestError: { serviceException: { text: "Server error" } } },
        500,
      ),
    );

    const pending = provider.send({ to: "+919391541081", body: "test" });
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await pending;

    expect(result.success).toBe(false);
    expect(result.error).toContain("Infobip API error (500)");
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});
