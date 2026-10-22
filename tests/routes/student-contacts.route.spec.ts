// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockGetStudentContacts = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["STUDENT"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["STUDENT"] });

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/student/get-student-contacts.service", () => ({
  getStudentContacts: (...args: any[]) => mockGetStudentContacts(...args),
}));

import { GET } from "@/app/api/v1/students/contacts/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["STUDENT"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["STUDENT"] });
  mockGetStudentContacts.mockResolvedValue([
    {
      id: "P1",
      name: "John Doe",
      relationship: "Father",
      maskedPhone: "+91 XXXXX 43210",
      isPrimary: true,
      hasValidPhone: true,
    },
  ]);
});

describe("GET /api/v1/students/contacts", () => {
  it("returns student contacts with masked phones", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toEqual({
      id: "P1",
      name: "John Doe",
      relationship: "Father",
      maskedPhone: "+91 XXXXX 43210",
      isPrimary: true,
      hasValidPhone: true,
    });
    expect(mockGetStudentContacts).toHaveBeenCalledWith("U1");
  });

  it("handles errors gracefully", async () => {
    mockGetStudentContacts.mockRejectedValue(new Error("Database error"));
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
  });
});
