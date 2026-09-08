import { describe, expect, it } from "vitest";

import {
  isValidPhoneNumber,
  normalizePhoneNumber,
} from "@/utils/phone";

describe("normalizePhoneNumber", () => {
  it("leaves clean 10-digit mobiles untouched", () => {
    expect(normalizePhoneNumber("9876543210")).toBe("9876543210");
  });

  it("strips separators", () => {
    expect(normalizePhoneNumber("98765 43210")).toBe("9876543210");
    expect(normalizePhoneNumber("98765-43210")).toBe("9876543210");
    expect(normalizePhoneNumber("(98765) 43210")).toBe("9876543210");
  });

  it("strips country and trunk prefixes", () => {
    expect(normalizePhoneNumber("+919876543210")).toBe("9876543210");
    expect(normalizePhoneNumber("919876543210")).toBe("9876543210");
    expect(normalizePhoneNumber("09876543210")).toBe("9876543210");
  });

  it("leaves malformed digit strings intact for the validator to reject", () => {
    expect(normalizePhoneNumber("94927079771")).toBe("94927079771");
    expect(normalizePhoneNumber("")).toBe("");
  });
});

describe("isValidPhoneNumber", () => {
  it.each([
    "9876543210",
    "6123456789",
    "+919876543210",
    "919876543210",
    "09876543210",
    "98765 43210",
    "98765-43210",
  ])("accepts %s", (input) => {
    expect(isValidPhoneNumber(input)).toBe(true);
  });

  it.each([
    "",
    "12345",
    "94927079771", // 11 digits: the typo class that reached production
    "0987654321", // trunk zero without country code is not a mobile
    "1234567890", // valid length, invalid first digit
    "5876543210", // valid length, invalid first digit
    "abcdefghij",
    "987654321012345678901", // over the input bound
  ])("rejects %s", (input) => {
    expect(isValidPhoneNumber(input)).toBe(false);
  });
});
