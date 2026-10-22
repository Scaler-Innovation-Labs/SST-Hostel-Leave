// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const mockWhere = vi.fn();
const mockLeftJoin = vi.fn();

vi.mock("@/lib/db", () => {
  const chain = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn((...args: any[]) => {
      mockLeftJoin(...args);
      return chain;
    }),
    where: vi.fn((...args: any[]) => {
      mockWhere(...args);
      return chain;
    }),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => Promise.resolve([])),
  };
  return {
    db: {
      select: vi.fn(() => chain),
    },
  };
});

import { parentRepository } from "@/db/repositories/parent/parent.repository";

beforeEach(() => {
  mockWhere.mockClear();
  mockLeftJoin.mockClear();
});

describe("parentRepository.findAll", () => {
  it("includes student name and roll number in search conditions and joins", async () => {
    await parentRepository.findAll({
      search: "Varshit",
      page: 1,
      limit: 20,
    });

    expect(mockWhere).toHaveBeenCalled();
    const whereSql = new PgDialect().sqlToQuery(mockWhere.mock.calls[0]![0]).sql;

    // Both users.full_name and students.roll_number must be included in the search criteria
    expect(whereSql).toContain("users");
    expect(whereSql).toContain("full_name");
    expect(whereSql).toContain("students");
    expect(whereSql).toContain("roll_number");
  });
});
