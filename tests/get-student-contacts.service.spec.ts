// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindByUserId = vi.fn();
const mockFindByStudentId = vi.fn();

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findByUserId: (...args: any[]) => mockFindByUserId(...args),
  },
}));

vi.mock("@/db/repositories/parent/parent.repository", () => ({
  parentRepository: {
    findByStudentId: (...args: any[]) => mockFindByStudentId(...args),
  },
}));

import { getStudentContacts } from "@/services/student/get-student-contacts.service";
import { NotFoundError } from "@/lib/errors";

beforeEach(() => {
  vi.clearAllMocks();
  mockFindByUserId.mockResolvedValue({ id: "S1", userId: "U1" });
  mockFindByStudentId.mockResolvedValue([
    {
      id: "P1",
      name: "Ramesh Sharma",
      relationship: "Father",
      phone: "+919876543210",
      isPrimary: true,
    },
    {
      id: "P2",
      name: "Sunita Sharma",
      relationship: "Mother",
      phone: "9123456789",
      isPrimary: false,
    },
  ]);
});

describe("getStudentContacts service", () => {
  it("returns contacts for the student with masked phone numbers", async () => {
    const contacts = await getStudentContacts("U1");

    expect(contacts).toHaveLength(2);
    expect(contacts[0]).toEqual({
      id: "P1",
      name: "Ramesh Sharma",
      relationship: "Father",
      maskedPhone: "+91 XXXXX 43210",
      isPrimary: true,
      hasValidPhone: true,
    });
    expect(contacts[1]).toEqual({
      id: "P2",
      name: "Sunita Sharma",
      relationship: "Mother",
      maskedPhone: "+91 XXXXX 56789",
      isPrimary: false,
      hasValidPhone: true,
    });
  });

  it("throws NotFoundError when student is not found", async () => {
    mockFindByUserId.mockResolvedValue(null);

    await expect(getStudentContacts("U-UNKNOWN")).rejects.toBeInstanceOf(NotFoundError);
  });
});
