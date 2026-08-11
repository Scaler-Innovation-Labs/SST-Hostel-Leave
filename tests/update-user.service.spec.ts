// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindById = vi.fn();
const mockFindByEmail = vi.fn();
const mockUpdateUser = vi.fn();
const mockReplaceRoles = vi.fn();
const mockFindByIdWithRoles = vi.fn();
const mockFindRolesByCodes = vi.fn();
const mockFindRoleCodesByUserId = vi.fn();
const mockFindUserIdsByRoleCode = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { transaction: (cb: any) => cb({}) },
}));

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    findById: (...args: any[]) => mockFindById(...args),
    findByEmail: (...args: any[]) => mockFindByEmail(...args),
    updateUser: (...args: any[]) => mockUpdateUser(...args),
    replaceRoles: (...args: any[]) => mockReplaceRoles(...args),
    findByIdWithRoles: (...args: any[]) => mockFindByIdWithRoles(...args),
  },
}));

vi.mock("@/db/repositories/auth/user-role.repository", () => ({
  userRoleRepository: {
    findRolesByCodes: (...args: any[]) => mockFindRolesByCodes(...args),
    findRoleCodesByUserId: (...args: any[]) => mockFindRoleCodesByUserId(...args),
    findUserIdsByRoleCode: (...args: any[]) => mockFindUserIdsByRoleCode(...args),
  },
}));

import { ConflictError, NotFoundError } from "@/lib/errors";
import { updateUser } from "@/services/user/update-user.service";

const EXISTING_USER = {
  id: "U1",
  fullName: "Super Admin",
  email: "super@example.com",
  isActive: true,
};

const UPDATED = { ...EXISTING_USER, userRoles: [{ roleCode: "ADMIN", roleName: "Admin" }] };

beforeEach(() => {
  vi.resetAllMocks();
  mockFindById.mockResolvedValue(EXISTING_USER);
  mockFindRolesByCodes.mockResolvedValue([
    { id: "R1", code: "ADMIN" },
    { id: "R2", code: "SUPER_ADMIN" },
  ]);
  mockFindByIdWithRoles.mockResolvedValue(UPDATED);
});

describe("updateUser service", () => {
  it("updates profile and replaces roles", async () => {
    mockFindRoleCodesByUserId.mockResolvedValue(["SUPER_ADMIN"]);
    mockFindUserIdsByRoleCode.mockResolvedValue(["U1", "U9"]);

    const result = await updateUser("U1", { roleCodes: ["ADMIN"] });

    expect(result).toEqual(UPDATED);
    expect(mockReplaceRoles).toHaveBeenCalledWith(
      "U1",
      ["R1"],
      expect.anything(),
    );
  });

  it("throws NotFoundError when the user does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(updateUser("U9", { roleCodes: ["ADMIN"] })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("blocks removing the last super admin", async () => {
    mockFindRoleCodesByUserId.mockResolvedValue(["SUPER_ADMIN"]);
    mockFindUserIdsByRoleCode.mockResolvedValue(["U1"]);

    await expect(
      updateUser("U1", { roleCodes: ["ADMIN"] }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(mockReplaceRoles).not.toHaveBeenCalled();
  });

  it("allows removing super admin when another super admin exists", async () => {
    mockFindRoleCodesByUserId.mockResolvedValue(["SUPER_ADMIN"]);
    mockFindUserIdsByRoleCode.mockResolvedValue(["U1", "U9"]);

    const result = await updateUser("U1", { roleCodes: ["ADMIN"] });

    expect(result).toEqual(UPDATED);
    expect(mockReplaceRoles).toHaveBeenCalled();
  });

  it("skips the guard when roles are not being changed", async () => {
    const result = await updateUser("U1", { fullName: "Renamed" });

    expect(result).toEqual(UPDATED);
    expect(mockReplaceRoles).not.toHaveBeenCalled();
    expect(mockFindRoleCodesByUserId).not.toHaveBeenCalled();
  });
});
