// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockCountPendingApprovals = vi.fn();
const mockCountPendingExtensionApprovals = vi.fn();

vi.mock("@/db/repositories/leave/leave-approval.repository", () => ({
  leaveApprovalRepository: {
    countPendingApprovals: (...args: any[]) => mockCountPendingApprovals(...args),
    countPendingExtensionApprovals: (...args: any[]) => mockCountPendingExtensionApprovals(...args),
  },
}));

const mockCountOverdueReturns = vi.fn();
vi.mock("@/services/movement/count-overdue-returns.service", () => ({
  countOverdueReturns: (...args: any[]) => mockCountOverdueReturns(...args),
}));

const mockIsStaffScopeRestricted = vi.fn();
const mockGetScopedHostelIds = vi.fn();
vi.mock("@/services/shared/authorization.service", () => ({
  isStaffScopeRestricted: (...args: any[]) => mockIsStaffScopeRestricted(...args),
  getScopedHostelIds: (...args: any[]) => mockGetScopedHostelIds(...args),
}));

import { getNavBadges } from "@/services/shared/get-nav-badges.service";

describe("getNavBadges Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCountPendingApprovals.mockResolvedValue(5);
    mockCountPendingExtensionApprovals.mockResolvedValue(2);
    mockCountOverdueReturns.mockResolvedValue(3);
    mockIsStaffScopeRestricted.mockReturnValue(false);
    mockGetScopedHostelIds.mockReturnValue([]);
  });

  it("returns counts for an unrestricted admin using lightweight count queries", async () => {
    const adminUser = {
      id: "admin-1",
      roles: ["ADMIN"],
      roleScopes: [],
    };

    const badges = await getNavBadges(adminUser);

    expect(badges).toEqual({
      approvals: 5,
      extensionApprovals: 2,
      overdue: 3,
    });

    expect(mockCountPendingApprovals).toHaveBeenCalledWith({
      hostelIds: undefined,
      assignedApproverUserId: undefined,
    });
    expect(mockCountPendingExtensionApprovals).toHaveBeenCalledWith({
      hostelIds: undefined,
    });
    expect(mockCountOverdueReturns).toHaveBeenCalledWith(adminUser);
  });

  it("restricts counts to scoped hostels for hostel-restricted staff", async () => {
    mockIsStaffScopeRestricted.mockReturnValue(true);
    mockGetScopedHostelIds.mockReturnValue(["hostel-a", "hostel-b"]);

    const wardenUser = {
      id: "warden-1",
      roles: ["ADMIN"],
      roleScopes: [
        { roleCode: "ADMIN", scopeType: "HOSTEL", scopeId: "hostel-a" },
        { roleCode: "ADMIN", scopeType: "HOSTEL", scopeId: "hostel-b" },
      ],
    };

    const badges = await getNavBadges(wardenUser);

    expect(badges).toEqual({
      approvals: 5,
      extensionApprovals: 2,
      overdue: 3,
    });

    expect(mockCountPendingApprovals).toHaveBeenCalledWith({
      hostelIds: ["hostel-a", "hostel-b"],
      assignedApproverUserId: undefined,
    });
    expect(mockCountPendingExtensionApprovals).toHaveBeenCalledWith({
      hostelIds: ["hostel-a", "hostel-b"],
    });
  });

  it("scopes pending approvals to assignedApproverUserId for POC-only users", async () => {
    const pocUser = {
      id: "poc-user-1",
      roles: ["POC"],
      roleScopes: [],
    };

    const badges = await getNavBadges(pocUser);

    expect(badges).toEqual({
      approvals: 5,
      extensionApprovals: 2,
      overdue: 3,
    });

    expect(mockCountPendingApprovals).toHaveBeenCalledWith({
      hostelIds: undefined,
      assignedApproverUserId: "poc-user-1",
    });
  });
});
