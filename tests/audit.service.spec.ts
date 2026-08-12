// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockCreate = vi.fn();
const mockFindByEntity = vi.fn();
const mockFindByUserId = vi.fn();
const mockFindById = vi.fn();

vi.mock("@/db/repositories/audit/audit.repository", () => ({
  auditRepository: {
    create: (...args: any[]) => mockCreate(...args),
    findByEntity: (...args: any[]) => mockFindByEntity(...args),
  },
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findByUserId: (...args: any[]) => mockFindByUserId(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockFindById(...args),
  },
}));

import { auditService } from "@/services/audit/audit.service";
import { AuthorizationError } from "@/lib/errors";

const ADMIN = { id: "U1", roles: ["ADMIN"] };
const STUDENT = { id: "U2", roles: ["STUDENT"] };

beforeEach(() => {
  vi.resetAllMocks();
  mockCreate.mockResolvedValue({ id: "A1" });
  mockFindByEntity.mockResolvedValue({ items: [], total: 0 });
});

describe("auditService.record", () => {
  it("creates an audit log with metadata", async () => {
    const result = await auditService.record("CREATE", "HOSTEL", "H1", "U1", { extra: 1 });

    expect(result).toEqual({ id: "A1" });
    expect(mockCreate).toHaveBeenCalledWith(
      { action: "CREATE", entityType: "HOSTEL", entityId: "H1", actorUserId: "U1", metadata: { extra: 1 } },
      expect.anything(),
    );
  });
});

describe("auditService.listAuditLogs", () => {
  const query = { entityType: "LEAVE_REQUEST", entityId: "LR1" };

  it("allows admins and super-admins to read any entity", async () => {
    await auditService.listAuditLogs(query, ADMIN);

    expect(mockFindByEntity).toHaveBeenCalledWith("LEAVE_REQUEST", "LR1");
    expect(mockFindByUserId).not.toHaveBeenCalled();
  });

  it("allows a student to read their own leave's audit log", async () => {
    mockFindByUserId.mockResolvedValue({ id: "S1" });
    mockFindById.mockResolvedValue({ id: "LR1", studentId: "S1" });

    await auditService.listAuditLogs(query, STUDENT);

    expect(mockFindByEntity).toHaveBeenCalledWith("LEAVE_REQUEST", "LR1");
  });

  it("denies a student viewing another student's leave", async () => {
    mockFindByUserId.mockResolvedValue({ id: "S1" });
    mockFindById.mockResolvedValue({ id: "LR1", studentId: "S2" });

    await expect(auditService.listAuditLogs(query, STUDENT)).rejects.toBeInstanceOf(AuthorizationError);
    expect(mockFindByEntity).not.toHaveBeenCalled();
  });

  it("denies a student querying non-leave entities", async () => {
    mockFindByUserId.mockResolvedValue({ id: "S1" });

    await expect(
      auditService.listAuditLogs({ entityType: "HOSTEL", entityId: "H1" }, STUDENT),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("denies a student without a profile", async () => {
    mockFindByUserId.mockResolvedValue(null);

    await expect(auditService.listAuditLogs(query, STUDENT)).rejects.toBeInstanceOf(AuthorizationError);
  });
});
