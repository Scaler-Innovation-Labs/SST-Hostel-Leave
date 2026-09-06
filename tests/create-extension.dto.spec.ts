import { describe, expect, it } from "vitest";

import { createExtensionSchema } from "@/dto/leave/create-extension.dto";

describe("createExtensionSchema bounds", () => {
  const valid = {
    requestedEndAt: new Date("2026-10-01T10:00:00Z").toISOString(),
    reason: "Need more time",
  };

  it("accepts ISO datetimes", () => {
    expect(createExtensionSchema.parse(valid).requestedEndAt).toBe(valid.requestedEndAt);
  });

  it("accepts datetime-local values (client form format)", () => {
    const parsed = createExtensionSchema.parse({ ...valid, requestedEndAt: "2026-10-01T10:00" });
    expect(parsed.requestedEndAt).toBe("2026-10-01T10:00");
  });

  it("rejects garbage dates that would become Invalid Date", () => {
    expect(() =>
      createExtensionSchema.parse({ ...valid, requestedEndAt: "not-a-date" })
    ).toThrow(/valid date/i);
  });

  it("caps reason length", () => {
    expect(() =>
      createExtensionSchema.parse({ ...valid, reason: "x".repeat(1001) })
    ).toThrow();
  });

  it("caps submittedForm key count and size", () => {
    const manyKeys = Object.fromEntries(
      Array.from({ length: 51 }, (_, i) => [`k${i}`, "v"])
    );
    expect(() =>
      createExtensionSchema.parse({ ...valid, submittedForm: manyKeys })
    ).toThrow(/at most 50/i);

    const bigValue = { big: "x".repeat(25_000) };
    expect(() =>
      createExtensionSchema.parse({ ...valid, submittedForm: bigValue })
    ).toThrow(/too large/i);
  });

  it("accepts a small well-formed submittedForm", () => {
    const parsed = createExtensionSchema.parse({
      ...valid,
      submittedForm: { destination: "Home", phone: "123" },
    });
    expect(parsed.submittedForm).toEqual({ destination: "Home", phone: "123" });
  });
});
