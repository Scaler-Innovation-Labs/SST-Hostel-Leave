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

import { bulkCreateStudents, normalizeStudentRow } from "@/services/student/bulk-create-students.service";
import { ValidationError } from "@/lib/errors";

const MOCK_USER = { id: "U1" };
const MOCK_STUDENT = { id: "S1", rollNumber: "S001", userId: "U1" };
const MOCK_ROLE = { id: "R1" };

const VALID_ROW = {
  rollNumber: "S001",
  fullName: "John Doe",
  academicGroupId: "550e8400-e29b-41d4-a716-446655440000",
  parentName: "John Doe Sr.",
  parentPhone: "9123456789",
  parentRelationship: "Father",
};

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

describe("normalizeStudentRow", () => {
  it("normalizes parent fields from multiple header variants", () => {
    const row = normalizeStudentRow(
      {
        rollNumber: "S001",
        fullName: "John Doe",
        academicGroupId: "550e8400-e29b-41d4-a716-446655440000",
        "Parent Name": "Jane Doe Sr.",
        "Parent Phone": "9988776655",
        "Parent Relationship": "Mother",
      },
      0,
    );

    expect(row.parentName).toBe("Jane Doe Sr.");
    expect(row.parentPhone).toBe("9988776655");
    expect(row.parentRelationship).toBe("Mother");
  });

  it("rejects a row missing parentName", () => {
    const { parentName, ...rest } = VALID_ROW;

    expect(() => normalizeStudentRow(rest, 0)).toThrow(ValidationError);
    expect(() => normalizeStudentRow(rest, 0)).toThrow(/parentName is required/);
  });

  it("rejects a row missing parentPhone", () => {
    const { parentPhone, ...rest } = VALID_ROW;

    expect(() => normalizeStudentRow(rest, 0)).toThrow(/parentPhone is required/);
  });

  it("rejects a row missing parentRelationship", () => {
    const { parentRelationship, ...rest } = VALID_ROW;

    expect(() => normalizeStudentRow(rest, 0)).toThrow(/parentRelationship is required/);
  });
});

describe("bulkCreateStudents", () => {
  it("creates a primary parent for each student row", async () => {
    const results = await bulkCreateStudents([VALID_ROW], "ADMIN1");

    expect(results).toEqual([{ rollNumber: "S001", success: true }]);
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

  it("reports a row failure when parent fields are missing", async () => {
    const { parentName, parentPhone, parentRelationship, ...rest } = VALID_ROW;

    const results = await bulkCreateStudents([rest]);

    // Normalization throws before the roll number is assigned, so the row
    // is reported with an empty rollNumber — the error message carries the
    // real one.
    expect(results).toEqual([
      { rollNumber: "", success: false, error: expect.stringContaining("Row 1: parentName is required") },
    ]);
    expect(mockCreateParent).not.toHaveBeenCalled();
  });
});
