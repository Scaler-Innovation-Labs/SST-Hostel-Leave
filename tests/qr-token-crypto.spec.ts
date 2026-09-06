import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfigurationError, ValidationError } from "@/lib/errors";
import { decryptQrToken, encryptQrToken } from "@/lib/qr-token-crypto";

const TEST_KEY = "ab".repeat(32);
const OTHER_KEY = "cd".repeat(32);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("qr-token-crypto", () => {
  it("round-trips a token through encrypt/decrypt", async () => {
    vi.stubEnv("QR_TOKEN_ENC_KEY", TEST_KEY);

    const envelope = await encryptQrToken("sensitive-bearer-token");
    await expect(decryptQrToken(envelope)).resolves.toBe("sensitive-bearer-token");
  });

  it("emits a versioned v1 envelope with key id", async () => {
    vi.stubEnv("QR_TOKEN_ENC_KEY", TEST_KEY);

    const envelope = await encryptQrToken("token");
    expect(envelope).toMatch(/^v1:[A-Za-z0-9_-]{1,16}:[A-Za-z0-9\-_]+:[A-Za-z0-9\-_]+$/);
  });

  it("decrypts legacy v1 envelopes without key id via the active key", async () => {
    vi.stubEnv("QR_TOKEN_ENC_KEY", TEST_KEY);
    const legacy = await encryptQrToken("legacy-token");
    const [, , iv, ct] = legacy.split(":");
    const legacyEnvelope = `v1:${iv}:${ct}`;

    await expect(decryptQrToken(legacyEnvelope)).resolves.toBe("legacy-token");
  });

  it("decrypts historic key ids after rotation", async () => {
    vi.stubEnv("QR_TOKEN_ENC_KEY", OTHER_KEY);
    vi.stubEnv("QR_TOKEN_ENC_ACTIVE_KEY_ID", "k2");
    vi.stubEnv("QR_TOKEN_ENC_KEY_K2", OTHER_KEY);
    const rotated = await encryptQrToken("rotated-token");

    vi.stubEnv("QR_TOKEN_ENC_KEY", TEST_KEY);
    vi.stubEnv("QR_TOKEN_ENC_ACTIVE_KEY_ID", "k1");
    vi.stubEnv("QR_TOKEN_ENC_KEY_K1", TEST_KEY);
    vi.stubEnv("QR_TOKEN_ENC_KEY_K2", OTHER_KEY);
    await expect(decryptQrToken(rotated)).resolves.toBe("rotated-token");
  });

  it("uses a fresh IV per encryption (same token, different envelopes)", async () => {
    vi.stubEnv("QR_TOKEN_ENC_KEY", TEST_KEY);

    const first = await encryptQrToken("same-token");
    const second = await encryptQrToken("same-token");
    expect(first).not.toBe(second);
    await expect(decryptQrToken(first)).resolves.toBe("same-token");
    await expect(decryptQrToken(second)).resolves.toBe("same-token");
  });

  it("rejects decryption with a different key", async () => {
    vi.stubEnv("QR_TOKEN_ENC_KEY", TEST_KEY);
    const envelope = await encryptQrToken("token");

    vi.stubEnv("QR_TOKEN_ENC_KEY", OTHER_KEY);
    await expect(decryptQrToken(envelope)).rejects.toBeInstanceOf(ConfigurationError);
  });

  it("rejects a tampered envelope without leaking credential material", async () => {
    vi.stubEnv("QR_TOKEN_ENC_KEY", TEST_KEY);
    const envelope = await encryptQrToken("secret-token-value");
    const tampered = envelope.slice(0, -2) + (envelope.endsWith("AA") ? "BB" : "AA");

    const failure = await decryptQrToken(tampered).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ConfigurationError);
    const message = (failure as Error).message;
    expect(message).not.toContain("secret-token-value");
    expect(message).not.toContain(tampered);
  });

  it("rejects an unsupported envelope version", async () => {
    vi.stubEnv("QR_TOKEN_ENC_KEY", TEST_KEY);

    await expect(decryptQrToken("v9:abcd:efgh")).rejects.toBeInstanceOf(ConfigurationError);
    await expect(decryptQrToken("not-an-envelope")).rejects.toBeInstanceOf(ConfigurationError);
  });

  it("fails loudly when the key is missing", async () => {
    vi.stubEnv("QR_TOKEN_ENC_KEY", "");

    await expect(encryptQrToken("token")).rejects.toBeInstanceOf(ConfigurationError);
    await expect(decryptQrToken("v1:abcd:efgh")).rejects.toBeInstanceOf(ConfigurationError);
  });

  it("fails loudly when the key has an invalid format", async () => {
    vi.stubEnv("QR_TOKEN_ENC_KEY", "too-short");

    await expect(encryptQrToken("token")).rejects.toBeInstanceOf(ConfigurationError);
  });

  it("refuses to encrypt an empty token", async () => {
    vi.stubEnv("QR_TOKEN_ENC_KEY", TEST_KEY);

    await expect(encryptQrToken("")).rejects.toBeInstanceOf(ValidationError);
    await expect(decryptQrToken("")).rejects.toBeInstanceOf(ValidationError);
  });
});
