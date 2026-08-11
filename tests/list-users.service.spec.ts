// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindAll = vi.fn();

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    findAll: (...args: any[]) => mockFindAll(...args),
  },
}));

import { listUsers } from "@/services/user/list-users.service";

const MOCK_RESULT = {
  items: [{ id: "U1", fullName: "Test User", email: "test@example.com", isActive: true, userRoles: [{ roleCode: "STUDENT", roleName: "Student" }] }],
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
};

beforeEach(() => {
  vi.resetAllMocks();
  mockFindAll.mockResolvedValue(MOCK_RESULT);
});

describe("listUsers service", () => {
  it("returns paginated users", async () => {
    const result = await listUsers({ page: 1, limit: 20 });

    expect(result).toEqual(MOCK_RESULT);
    expect(mockFindAll).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }));
  });

  it("passes search filter", async () => {
    await listUsers({ page: 1, limit: 20, search: "test" });

    expect(mockFindAll).toHaveBeenCalledWith(expect.objectContaining({ search: "test" }));
  });

  it("passes role filter", async () => {
    await listUsers({ page: 1, limit: 20, role: "STUDENT" });

    expect(mockFindAll).toHaveBeenCalledWith(expect.objectContaining({ role: "STUDENT" }));
  });

  it("passes excludeRole filter", async () => {
    await listUsers({ page: 1, limit: 20, excludeRole: "SUPER_ADMIN" });

    expect(mockFindAll).toHaveBeenCalledWith(expect.objectContaining({ excludeRole: "SUPER_ADMIN" }));
  });

  it("passes isActive filter", async () => {
    await listUsers({ page: 1, limit: 20, isActive: true });

    expect(mockFindAll).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
  });
});
