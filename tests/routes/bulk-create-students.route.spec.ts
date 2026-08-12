// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockBulkCreateStudents = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/student/bulk-create-students.service", () => ({
  bulkCreateStudents: (...args: any[]) => mockBulkCreateStudents(...args),
}));

import { POST } from "@/app/api/v1/students/bulk/route";

const RESULTS = [
  { rollNumber: "S001", success: true },
  { rollNumber: "S002", success: true },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockBulkCreateStudents.mockResolvedValue(RESULTS);
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost:3000/api/v1/students/bulk", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/students/bulk", () => {
  it("creates students from a JSON array and returns per-row results", async () => {
    const rows = [
      { rollNumber: "S001", fullName: "John Doe", academicGroupId: "G1" },
      { rollNumber: "S002", fullName: "Jane Doe", academicGroupId: "G1" },
    ];

    const res = await POST(jsonReq(rows));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      total: 2,
      succeeded: 2,
      failed: 0,
      results: RESULTS,
    });
    expect(mockBulkCreateStudents).toHaveBeenCalledWith(rows, "U1");
  });

  it("parses a CSV payload into rows before calling the service", async () => {
    const csv = "rollNumber,fullName,academicGroupId\nS001,John Doe,G1\nS002,Jane Doe,G1\n";

    const res = await POST(
      new Request("http://localhost:3000/api/v1/students/bulk", {
        method: "POST",
        headers: { "content-type": "text/csv" },
        body: csv,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockBulkCreateStudents).toHaveBeenCalledWith(
      [
        { rollNumber: "S001", fullName: "John Doe", academicGroupId: "G1" },
        { rollNumber: "S002", fullName: "Jane Doe", academicGroupId: "G1" },
      ],
      "U1",
    );
  });

  it("rejects an empty array", async () => {
    const res = await POST(jsonReq([]));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(mockBulkCreateStudents).not.toHaveBeenCalled();
  });

  it("rejects a non-array payload", async () => {
    const res = await POST(jsonReq({ not: "an array" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(mockBulkCreateStudents).not.toHaveBeenCalled();
  });

  it("rejects requests above the max row count", async () => {
    const rows = Array.from({ length: 2001 }, (_, i) => ({
      rollNumber: `S${i}`,
      fullName: `Student ${i}`,
      academicGroupId: "G1",
    }));

    const res = await POST(jsonReq(rows));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(mockBulkCreateStudents).not.toHaveBeenCalled();
  });

  it("enforces super-admin authorization", async () => {
    const { AuthorizationError } = await import("@/lib/errors");
    mockRequireAnyRole.mockImplementation(() => {
      throw new AuthorizationError();
    });

    const res = await POST(jsonReq([{ rollNumber: "S001", fullName: "John", academicGroupId: "G1" }]));

    expect(res.status).toBe(403);
    expect(mockBulkCreateStudents).not.toHaveBeenCalled();
  });
});
