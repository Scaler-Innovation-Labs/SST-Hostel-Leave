// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockFindByIdWithRelations = vi.fn();

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findByIdWithRelations: (...args: any[]) => mockFindByIdWithRelations(...args),
  },
}));

import { getStudent } from "@/services/student/get-student.service";
import { AuthorizationError, NotFoundError } from "@/lib/errors";

const STUDENT_WITH_RELATIONS = {
  student: { id: "S1" },
  user: { id: "U1", hostelId: "H1", fullName: "Neerasa" },
  locationState: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFindByIdWithRelations.mockResolvedValue(STUDENT_WITH_RELATIONS);
});

describe("getStudent service", () => {
  it("returns the student for a super admin", async () => {
    const result = await getStudent("S1", {
      id: "U9",
      roles: ["SUPER_ADMIN"],
    });

    expect(result.student.id).toBe("S1");
    expect(mockFindByIdWithRelations).toHaveBeenCalledWith("S1");
  });

  it("throws NotFoundError when the student does not exist", async () => {
    mockFindByIdWithRelations.mockResolvedValue(null);

    await expect(
      getStudent("S1", { id: "U9", roles: ["SUPER_ADMIN"] })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects a hostel-scoped admin viewing a student outside their hostels", async () => {
    const scopedAdmin = {
      id: "U2",
      roles: ["ADMIN"],
      roleScopes: [
        { roleCode: "ADMIN", scopeType: "HOSTEL", scopeId: "H1" },
      ],
    };
    mockFindByIdWithRelations.mockResolvedValue({
      student: { id: "S2" },
      user: { id: "U2", hostelId: "H2" },
      locationState: null,
    });

    await expect(getStudent("S2", scopedAdmin)).rejects.toBeInstanceOf(
      AuthorizationError
    );
    // The guard resolves the student's hostel before denying, so the lookup
    // happens — but the profile is never returned to the caller.
    expect(mockFindByIdWithRelations).toHaveBeenCalledWith("S2");
  });
});
