// @ts-nocheck
import { describe, expect, it } from "vitest";

import {
  DLT_FIXED_TEXT_LENGTH,
  DLT_MAX_NAME_LENGTH,
  buildParentApprovalDltName,
} from "@/lib/messaging/sms/dlt";

describe("buildParentApprovalDltName", () => {
  it("returns the full name when it fits within the budget", () => {
    expect(buildParentApprovalDltName("John Doe")).toBe("John Doe");
  });

  it("trims surrounding whitespace", () => {
    expect(buildParentApprovalDltName("  John Doe  ")).toBe("John Doe");
  });

  it("returns the full name when it exactly fills the budget", () => {
    const name = "J".repeat(DLT_MAX_NAME_LENGTH);
    expect(buildParentApprovalDltName(name)).toBe(name);
  });

  it("falls back to the first name when the full name is too long", () => {
    const name = `Longfirst ${"S".repeat(DLT_MAX_NAME_LENGTH + 10)}`;
    expect(buildParentApprovalDltName(name)).toBe("Longfirst");
  });

  it("truncates the first name when even it exceeds the budget", () => {
    const firstName = "M".repeat(DLT_MAX_NAME_LENGTH + 5);
    const result = buildParentApprovalDltName(firstName);
    expect(result).toHaveLength(DLT_MAX_NAME_LENGTH);
  });

  it("keeps the message (excluding the approval link) within 130 chars", () => {
    const name = buildParentApprovalDltName("R".repeat(100));
    const shortUrl = "https://scaler.short.gy/xxxxxxxx";
    const message = `Dear Parent,${name} has applied for a Leave. Kindly click the link to review: ${shortUrl} -Scaler School of Technology`;
    const withoutLink = message.replace(shortUrl, "");

    expect(name.length).toBeLessThanOrEqual(DLT_MAX_NAME_LENGTH);
    expect(DLT_FIXED_TEXT_LENGTH + name.length).toBeLessThanOrEqual(130);
    expect(withoutLink.length).toBeLessThanOrEqual(130);
  });

  it("keeps the final SMS within 160 chars with a shortened link", () => {
    const name = buildParentApprovalDltName("R".repeat(100));
    const shortUrl = "https://scaler.short.gy/ab12";
    const message = `Dear Parent,${name} has applied for a Leave. Kindly click the link to review: ${shortUrl} -Scaler School of Technology`;

    expect(message.length).toBeLessThanOrEqual(160);
  });
});
