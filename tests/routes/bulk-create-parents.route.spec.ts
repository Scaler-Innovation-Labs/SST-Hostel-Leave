// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockBulkCreateParents = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/parent/bulk-create-parents.service", () => ({
  bulkCreateParents: (...args: any[]) => mockBulkCreateParents(...args),
}));

import { POST } from "@/app/api/v1/parents/bulk/route";

const RESULTS = [
  { row: 1, success: true },
  { row: 2, success: false, error: "Duplicate phone" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockBulkCreateParents.mockResolvedValue(RESULTS);
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost:3000/api/v1/parents/bulk", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/parents/bulk", () => {
  it("creates parents from a JSON array and returns per-row results", async () => {
    const rows = [
      { studentEmail: "s1@example.com", name: "Parent One", phone: "+1234567890", relationship: "FATHER", isPrimary: "true" },
      { studentEmail: "s2@example.com", name: "Parent Two", phone: "+0987654321", relationship: "MOTHER", isPrimary: "false" },
    ];

    const res = await POST(jsonReq(rows));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      total: 2,
      succeeded: 1,
      failed: 1,
      results: RESULTS,
    });
    expect(mockBulkCreateParents).toHaveBeenCalledWith(rows, "U1");
  });

  it("parses a CSV payload into rows before calling the service", async () => {
    const csv = "studentEmail,name,phone,relationship,isPrimary\ns1@example.com,Parent One,+1234567890,FATHER,true\ns2@example.com,Parent Two,+0987654321,MOTHER,false\n";

    const res = await POST(
      new Request("http://localhost:3000/api/v1/parents/bulk", {
        method: "POST",
        headers: { "content-type": "text/csv" },
        body: csv,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockBulkCreateParents).toHaveBeenCalledWith(
      [
        { studentEmail: "s1@example.com", name: "Parent One", phone: "+1234567890", relationship: "FATHER", isPrimary: "true" },
        { studentEmail: "s2@example.com", name: "Parent Two", phone: "+0987654321", relationship: "MOTHER", isPrimary: "false" },
      ],
      "U1",
    );
  });

  it("rejects an empty array", async () => {
    const res = await POST(jsonReq([]));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(mockBulkCreateParents).not.toHaveBeenCalled();
  });

  it("rejects a non-array payload", async () => {
    const res = await POST(jsonReq({ not: "an array" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(mockBulkCreateParents).not.toHaveBeenCalled();
  });

  it("enforces super-admin authorization", async () => {
    const { AuthorizationError } = await import("@/lib/errors");
    mockRequireAnyRole.mockImplementation(() => {
      throw new AuthorizationError();
    });

    const res = await POST(jsonReq([{ studentEmail: "s1@example.com", name: "P", phone: "+1", relationship: "FATHER" }]));

    expect(res.status).toBe(403);
    expect(mockBulkCreateParents).not.toHaveBeenCalled();
  });
});
