// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";

// Capture the WHERE condition the repository builds so we can render the
// real SQL/params. Regression for the invalid-uuid (22P02) bug: passing an
// empty string as the exclude id produced `id <> ''`, which Postgres rejects
// and which surfaced as a generic 500 on the normal first-pass generate path.
const mockWhere = vi.fn();
const mockLimit = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/db", () => {
  const chain = {
    from: vi.fn(() => chain),
    where: (...args: any[]) => {
      mockWhere(...args);
      return chain;
    },
    orderBy: vi.fn(() => chain),
    limit: (...args: any[]) => mockLimit(...args),
  };
  return {
    db: {
      select: vi.fn(() => chain),
    },
  };
});

import { PgDialect } from "drizzle-orm/pg-core";

import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";

const STUDENT_ID = "11111111-1111-1111-1111-111111111111";
const PASS_ID = "22222222-2222-2222-2222-222222222222";

function lastWhere() {
  return new PgDialect().sqlToQuery(mockWhere.mock.calls.at(-1)![0]);
}

beforeEach(() => {
  mockWhere.mockClear();
  mockLimit.mockClear();
  mockLimit.mockResolvedValue([]);
});

describe("qrPassRepository.findUsableExitPassForStudent", () => {
  it("omits the id exclusion when no pass id is given (no invalid empty uuid)", async () => {
    await qrPassRepository.findUsableExitPassForStudent(
      STUDENT_ID,
      null,
      new Date("2026-06-10T00:00:00Z")
    );

    const { sql, params } = lastWhere();
    expect(sql).not.toContain('"qr_passes"."id" <>');
    expect(params).not.toContain("");
  });

  it("excludes the given pass id when provided", async () => {
    await qrPassRepository.findUsableExitPassForStudent(
      STUDENT_ID,
      PASS_ID,
      new Date("2026-06-10T00:00:00Z")
    );

    const { sql, params } = lastWhere();
    expect(sql).toContain('"qr_passes"."id" <>');
    expect(params).toContain(PASS_ID);
  });

  it("treats an empty-string id as no exclusion instead of emitting an invalid uuid", async () => {
    await qrPassRepository.findUsableExitPassForStudent(
      STUDENT_ID,
      "",
      new Date("2026-06-10T00:00:00Z")
    );

    const { sql, params } = lastWhere();
    expect(sql).not.toContain('"qr_passes"."id" <>');
    expect(params).not.toContain("");
  });
});
