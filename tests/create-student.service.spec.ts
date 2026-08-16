// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/db/transaction", () => ({
  transaction: (cb: any) => cb({}),
}));

const mockFindByRollNumber = vi.fn();
const mockCreateStudent = vi.fn();
const mockCreateUser = vi.fn();
const mockFindRolesByCodes = vi.fn();
const mockCreateUserRole = vi.fn();
const mockCreateParent = vi.fn();
const mockAuditRecord = vi.fn();

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findByRollNumber: (...args: any[]) => mockFindByRollNumber(...args),
    create: (...args: any[]) => mockCreateStudent(...args),
  },
}));

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    create: (...args: any[]) => mockCreateUser(...args),
  },
}));

vi.mock("@/db/repositories/auth/user-role.repository", () => ({
  userRoleRepository: {
    findRolesByCodes: (...args: any[]) => mockFindRolesByCodes(...args),
    create: (...args: any[]) => mockCreateUserRole(...args),
  },
}));

vi.mock("@/db/repositories/parent/parent.repository", () => ({
  parentRepository: {
    create: (...args: any[]) => mockCreateParent(...args),
  },
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: (...args: any[]) => mockAuditRecord(...args),
  },
}));

import { createStudent } from "@/services/student/create-student.service";
import { ConflictError } from "@/lib/errors";

const VALID_INPUT = {
  fullName: "John Doe",
  email: "john@example.com",
  rollNumber: "S001",
  academicGroupId: "550e8400-e29b-41d4-a716-446655440000",
  parentName: "John Doe Sr.",
  parentPhone: "9123456789",
  parentRelationship: "Father",
};

const MOCK_USER = { id: "U1" };
const MOCK_STUDENT = { id: "S1", rollNumber: "S001", userId: "U1" };
const MOCK_ROLE = { id: "R1" };

beforeEach(() => {
  vi.resetAllMocks();
  mockFindByRollNumber.mockResolvedValue(null);
  mockCreateUser.mockResolvedValue(MOCK_USER);
  mockCreateStudent.mockResolvedValue(MOCK_STUDENT);
  mockFindRolesByCodes.mockResolvedValue([MOCK_ROLE]);
  mockCreateUserRole.mockResolvedValue({});
  mockCreateParent.mockResolvedValue({ id: "P1" });
  mockAuditRecord.mockResolvedValue({});
});

describe("createStudent service", () => {
  it("creates a primary parent linked to the student in the same transaction", async () => {
    await createStudent(VALID_INPUT, "ADMIN1");

    expect(mockCreateParent).toHaveBeenCalledWith(
      {
        studentId: "S1",
        name: "John Doe Sr.",
        phone: "9123456789",
        email: null,
        relationship: "Father",
        isPrimary: true,
      },
      expect.any(Object),
    );
  });

  it("passes the parent email through when provided", async () => {
    await createStudent({ ...VALID_INPUT, parentEmail: "parent@example.com" });

    expect(mockCreateParent).toHaveBeenCalledWith(
      expect.objectContaining({ email: "parent@example.com" }),
      expect.any(Object),
    );
  });

  it("does not create a student or parent when the roll number already exists", async () => {
    mockFindByRollNumber.mockResolvedValue({ id: "EXISTING", rollNumber: "S001" });

    await expect(createStudent(VALID_INPUT)).rejects.toBeInstanceOf(ConflictError);
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockCreateStudent).not.toHaveBeenCalled();
    expect(mockCreateParent).not.toHaveBeenCalled();
  });
});
