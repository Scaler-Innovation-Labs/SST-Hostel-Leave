// @ts-nocheck
import { describe, it, expect } from "vitest";

import { parseCsv } from "@/utils/csv";

describe("parseCsv", () => {
  it("parses rows keyed by header", () => {
    const rows = parseCsv("rollNumber,fullName\nS001,John Doe\nS002,Jane Doe\n");

    expect(rows).toEqual([
      { rollNumber: "S001", fullName: "John Doe" },
      { rollNumber: "S002", fullName: "Jane Doe" },
    ]);
  });

  it("trims whitespace from headers and values", () => {
    const rows = parseCsv("  rollNumber , fullName  \n  S001  , John Doe \n");

    expect(rows).toEqual([{ rollNumber: "S001", fullName: "John Doe" }]);
  });

  it("fills missing values with empty strings", () => {
    const rows = parseCsv("a,b\n1,\n");

    expect(rows).toEqual([{ a: "1", b: "" }]);
  });

  it("skips blank lines", () => {
    const rows = parseCsv("a,b\n1,2\n\n\n3,4\n");

    expect(rows).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  it("returns an empty array when there is no data row", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("a,b\n")).toEqual([]);
    expect(parseCsv("only a header\n")).toEqual([]);
  });
});
