// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockCreateStudent = vi.fn();
const mockUpdateStudent = vi.fn();
const mockDeleteStudent = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/student/create-student.service", () => ({
  createStudent: (...args: any[]) => mockCreateStudent(...args),
}));

vi.mock("@/services/student/update-student.service", () => ({
  updateStudent: (...args: any[]) => mockUpdateStudent(...args),
}));

vi.mock("@/services/student/delete-student.service", () => ({
  deleteStudent: (...args: any[]) => mockDeleteStudent(...args),
}));

import { POST } from "@/app/api/v1/students/route";
import { PUT, DELETE } from "@/app/api/v1/students/[id]/route";

const STUDENT = { id: "S1", rollNumber: "S001", userId: "U9" };

const VALID_BODY = {
  rollNumber: "S001",
  fullName: "John Doe",
  academicGroupId: "550e8400-e29b-41d4-a716-446655440000",
  email: "john@example.com",
  parentName: "John Doe Sr.",
  parentPhone: "9123456789",
  parentRelationship: "Father",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockCreateStudent.mockResolvedValue(STUDENT);
  mockUpdateStudent.mockResolvedValue({ student: STUDENT, user: null, locationState: null });
  mockDeleteStudent.mockResolvedValue({ deleted: true });
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost:3000/api/v1/students", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/students", () => {
  it("creates a student with the authenticated actor", async () => {
    const res = await POST(jsonReq(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(STUDENT);
    expect(mockCreateStudent).toHaveBeenCalledWith(expect.objectContaining({ rollNumber: "S001" }), "U1");
  });

  it("rejects a body missing required fields", async () => {
    const res = await POST(jsonReq({ fullName: "No Roll" }));

    expect(res.status).toBe(400);
    expect(mockCreateStudent).not.toHaveBeenCalled();
  });
});

describe("PUT /api/v1/students/[id]", () => {
  it("updates a student", async () => {
    const res = await PUT(jsonReq({ fullName: "John Doe Jr." }), { params: Promise.resolve({ id: "S1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockUpdateStudent).toHaveBeenCalledWith("S1", expect.objectContaining({ fullName: "John Doe Jr." }), "U1");
  });
});

describe("DELETE /api/v1/students/[id]", () => {
  it("deletes a student", async () => {
    const res = await DELETE(new Request("http://localhost:3000/api/v1/students/S1"), {
      params: Promise.resolve({ id: "S1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ deleted: true });
    expect(mockDeleteStudent).toHaveBeenCalledWith("S1", "U1");
  });
});
