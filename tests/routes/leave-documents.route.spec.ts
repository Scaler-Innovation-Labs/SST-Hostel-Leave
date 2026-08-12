// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockDeleteDocument = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["STUDENT"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["STUDENT"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/leave/documents/delete-document.service", () => ({
  deleteLeaveDocument: (...args: any[]) => mockDeleteDocument(...args),
}));

import { DELETE } from "@/app/api/v1/leaves/[id]/documents/[documentId]/route";

const DOC_ID = "550e8400-e29b-41d4-a716-446655440000";
const LEAVE_ID = "550e8400-e29b-41d4-a716-446655440001";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["STUDENT"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["STUDENT"] });
  mockDeleteDocument.mockResolvedValue(undefined);
});

describe("DELETE /api/v1/leaves/[id]/documents/[documentId]", () => {
  it("deletes a document with the authenticated user", async () => {
    const res = await DELETE(
      new Request(`http://localhost:3000/api/v1/leaves/${LEAVE_ID}/documents/${DOC_ID}`),
      { params: Promise.resolve({ id: LEAVE_ID, documentId: DOC_ID }) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ deleted: true });
    expect(mockDeleteDocument).toHaveBeenCalledWith(DOC_ID, { id: "U1", roles: ["STUDENT"] });
  });
});
