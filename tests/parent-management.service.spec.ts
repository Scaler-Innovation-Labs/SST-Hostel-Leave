// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindAll = vi.fn();
const mockFindById = vi.fn();
const mockCreate = vi.fn();
const mockUpdateById = vi.fn();
const mockDeleteById = vi.fn();

vi.mock("@/db/repositories/parent/parent.repository", () => ({
  parentRepository: {
    findAll: (...args: any[]) => mockFindAll(...args),
    findById: (...args: any[]) => mockFindById(...args),
    create: (...args: any[]) => mockCreate(...args),
    updateById: (...args: any[]) => mockUpdateById(...args),
    deleteById: (...args: any[]) => mockDeleteById(...args),
  },
}));

import { parentManagementService } from "@/services/parent/parent-management.service";
import { NotFoundError } from "@/lib/errors";

const MOCK_PARENT = { id: "P1", studentId: "S1", name: "Parent One", phone: "+1234567890", relationship: "FATHER", isPrimary: true };
const MOCK_PARENTS_RESULT = { items: [MOCK_PARENT], total: 1 };

beforeEach(() => {
  vi.resetAllMocks();
  mockFindAll.mockResolvedValue(MOCK_PARENTS_RESULT);
  mockFindById.mockResolvedValue(MOCK_PARENT);
  mockCreate.mockResolvedValue(MOCK_PARENT);
  mockUpdateById.mockResolvedValue(MOCK_PARENT);
  mockDeleteById.mockResolvedValue(undefined);
});

describe("parentManagementService.list", () => {
  it("returns paginated parents", async () => {
    const result = await parentManagementService.list({ page: 1, limit: 20 });

    expect(result).toEqual(MOCK_PARENTS_RESULT);
    expect(mockFindAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it("passes search and studentId filters", async () => {
    await parentManagementService.list({ page: 1, limit: 20, search: "test", studentId: "S1" });

    expect(mockFindAll).toHaveBeenCalledWith({ page: 1, limit: 20, search: "test", studentId: "S1" });
  });
});

describe("parentManagementService.getById", () => {
  it("returns parent by id", async () => {
    const result = await parentManagementService.getById("P1");

    expect(result).toEqual(MOCK_PARENT);
    expect(mockFindById).toHaveBeenCalledWith("P1");
  });

  it("throws NotFoundError when not found", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(parentManagementService.getById("NONEXISTENT")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("parentManagementService.create", () => {
  const CREATE_DTO = { studentId: "S1", name: "Parent One", phone: "+1234567890", relationship: "FATHER", isPrimary: true };

  it("creates a parent", async () => {
    const result = await parentManagementService.create(CREATE_DTO);

    expect(result).toEqual(MOCK_PARENT);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: "Parent One", phone: "+1234567890" }));
  });

  it("sets email to null when not provided", async () => {
    await parentManagementService.create(CREATE_DTO);

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ email: null }));
  });

  it("passes email when provided", async () => {
    await parentManagementService.create({ ...CREATE_DTO, email: "parent@example.com" });

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ email: "parent@example.com" }));
  });
});

describe("parentManagementService.update", () => {
  it("updates a parent", async () => {
    const result = await parentManagementService.update("P1", { name: "Updated Name" });

    expect(result).toEqual(MOCK_PARENT);
    expect(mockFindById).toHaveBeenCalledWith("P1");
    expect(mockUpdateById).toHaveBeenCalledWith("P1", { name: "Updated Name" });
  });

  it("throws NotFoundError when not found", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(parentManagementService.update("NONEXISTENT", { name: "Test" })).rejects.toBeInstanceOf(NotFoundError);
    expect(mockUpdateById).not.toHaveBeenCalled();
  });
});

describe("parentManagementService.delete", () => {
  it("deletes a parent", async () => {
    await parentManagementService.delete("P1");

    expect(mockFindById).toHaveBeenCalledWith("P1");
    expect(mockDeleteById).toHaveBeenCalledWith("P1");
  });

  it("throws NotFoundError when not found", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(parentManagementService.delete("NONEXISTENT")).rejects.toBeInstanceOf(NotFoundError);
    expect(mockDeleteById).not.toHaveBeenCalled();
  });
});
