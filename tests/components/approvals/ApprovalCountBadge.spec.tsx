// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApprovalCountBadge } from "@/features/approvals/components/ApprovalCountBadge";

const mockUseNavBadges = vi.fn();

vi.mock("@/hooks/use-badges", () => ({
  useNavBadges: (...args: unknown[]) => mockUseNavBadges(...args),
}));

describe("ApprovalCountBadge", () => {
  beforeEach(() => {
    mockUseNavBadges.mockReset();
    mockUseNavBadges.mockReturnValue({
      badges: undefined,
      approvalsCount: 0,
      extensionApprovalsCount: 0,
      overdueCount: 0,
    });
  });

  it("renders nothing while data has not loaded", () => {
    mockUseNavBadges.mockReturnValue({
      badges: undefined,
      approvalsCount: 0,
      extensionApprovalsCount: 0,
      overdueCount: 0,
    });
    const { container } = render(<ApprovalCountBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when there are no pending approvals", () => {
    mockUseNavBadges.mockReturnValue({
      badges: { approvals: 0, extensionApprovals: 0, overdue: 0 },
      approvalsCount: 0,
      extensionApprovalsCount: 0,
      overdueCount: 0,
    });
    const { container } = render(<ApprovalCountBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the pending count as a pill", () => {
    mockUseNavBadges.mockReturnValue({
      badges: { approvals: 7, extensionApprovals: 0, overdue: 0 },
      approvalsCount: 7,
      extensionApprovalsCount: 0,
      overdueCount: 0,
    });
    render(<ApprovalCountBadge />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("caps the count at 99+", () => {
    mockUseNavBadges.mockReturnValue({
      badges: { approvals: 150, extensionApprovals: 0, overdue: 0 },
      approvalsCount: 150,
      extensionApprovalsCount: 0,
      overdueCount: 0,
    });
    render(<ApprovalCountBadge />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });
});
