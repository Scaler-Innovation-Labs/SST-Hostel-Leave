import { describe, expect, it } from "vitest";

import { fillDateRange } from "@/lib/analytics/trend";

describe("fillDateRange", () => {
  it("returns points for every day in range, filling gaps with zero", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-01-03T00:00:00Z");
    const result = fillDateRange(start, end, [
      { date: "2026-01-01", count: 2 },
      { date: "2026-01-03", count: 5 },
    ]);

    expect(result).toEqual([
      { date: "2026-01-01", value: 2 },
      { date: "2026-01-02", value: 0 },
      { date: "2026-01-03", value: 5 },
    ]);
  });

  it("returns a single day when start equals end", () => {
    const start = new Date("2026-02-01T00:00:00Z");
    const result = fillDateRange(start, start, [{ date: "2026-02-01", count: 1 }]);
    expect(result).toEqual([{ date: "2026-02-01", value: 1 }]);
  });

  it("returns empty array when end is before start", () => {
    const result = fillDateRange(new Date("2026-03-02T00:00:00Z"), new Date("2026-03-01T00:00:00Z"), []);
    expect(result).toEqual([]);
  });
});