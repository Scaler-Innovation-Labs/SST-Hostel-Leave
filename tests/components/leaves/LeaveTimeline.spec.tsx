// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LeaveTimeline } from "@/features/leaves/components/LeaveTimeline";

vi.mock("@/features/approvals/hooks/use-approval-chain", () => ({
  useApprovalChain: vi.fn(),
}));

vi.mock("@/hooks/use-movement", () => ({
  useMovement: vi.fn(),
}));

vi.mock("@/features/extensions/hooks/use-leave-extensions", () => ({
  useLeaveExtensions: vi.fn(),
}));

vi.mock("@/hooks/use-qr-passes", () => ({
  useQrPasses: vi.fn(),
}));

vi.mock("swr", () => ({
  default: vi.fn(() => ({ data: { data: { items: [], total: 0 } }, isLoading: false })),
}));

vi.mock("@/lib/api/leave-api", () => ({
  getQuestionsUrl: vi.fn(() => "/api/v1/leaves/1/questions"),
}));

import { useApprovalChain } from "@/features/approvals/hooks/use-approval-chain";
import { useLeaveExtensions } from "@/features/extensions/hooks/use-leave-extensions";
import { useMovement } from "@/hooks/use-movement";
import { useQrPasses } from "@/hooks/use-qr-passes";

describe("LeaveTimeline", () => {
  beforeEach(() => {
    vi.mocked(useMovement).mockReturnValue({
      movements: [],
      isLoading: false,
      isError: false,
      error: undefined,
      total: 0,
      mutate: vi.fn(),
    });
    vi.mocked(useLeaveExtensions).mockReturnValue({
      data: { items: [] },
      isLoading: false,
    } as any);
    vi.mocked(useQrPasses).mockReturnValue({
      qrPasses: [],
      isLoading: false,
    } as any);
  });

  it("places 'Request submitted' at the top, followed by Step 1 then Step 2 approvals", () => {
    vi.mocked(useApprovalChain).mockReturnValue({
      approvals: [
        {
          id: "app-2",
          leaveRequestId: "leave-1",
          assignedApproverUserId: null,
          actedByUserId: null,
          approverRoleId: "role-admin",
          approverRoleCode: "ADMIN",
          approverName: "Admin",
          decision: "PENDING",
          comments: null,
          createdAt: "2026-10-23T04:00:00.000Z",
          stepOrder: 2,
          stepKey: "ADMIN_APPROVAL",
        },
        {
          id: "app-1",
          leaveRequestId: "leave-1",
          assignedApproverUserId: null,
          actedByUserId: null,
          approverRoleId: "role-parent",
          approverRoleCode: "PARENT",
          approverName: "Neerasa Mohana Rao",
          approverPhone: "9391541081",
          decision: "PENDING",
          comments: null,
          createdAt: "2026-10-23T04:00:00.000Z",
          stepOrder: 1,
          stepKey: "PARENT_APPROVAL",
        },
      ] as any,
      total: 2,
      isLoading: false,
      isError: false,
      error: undefined,
      mutate: vi.fn(),
    });

    // Leave submitted slightly later in wall-clock time
    const leave = {
      id: "leave-1",
      submittedAt: "2026-10-23T04:00:00.050Z",
      createdAt: "2026-10-23T04:00:00.050Z",
    };

    const { container } = render(<LeaveTimeline leaveId="leave-1" leave={leave} />);

    const eventLabels = Array.from(container.querySelectorAll("li p.text-small")).map(
      (el) => el.textContent?.trim()
    );

    // Request submitted MUST be at the top (index 0)
    // Step 1 Parent Approval MUST precede Step 2 Admin Approval
    expect(eventLabels).toEqual([
      "Request submitted",
      "PARENT APPROVAL",
      "ADMIN APPROVAL",
    ]);
  });

  it("does not show misleading action timestamp for pending approvals", () => {
    vi.mocked(useApprovalChain).mockReturnValue({
      approvals: [
        {
          id: "app-1",
          leaveRequestId: "leave-1",
          assignedApproverUserId: null,
          actedByUserId: null,
          approverRoleId: "role-parent",
          approverRoleCode: "PARENT",
          approverName: "Neerasa Mohana Rao",
          approverPhone: "9391541081",
          decision: "PENDING",
          comments: null,
          createdAt: "2026-10-23T04:00:00.000Z",
          stepOrder: 1,
          stepKey: "PARENT_APPROVAL",
        },
      ] as any,
      total: 1,
      isLoading: false,
      isError: false,
      error: undefined,
      mutate: vi.fn(),
    });

    const leave = {
      id: "leave-1",
      submittedAt: "2026-10-23T04:00:00.000Z",
    };

    const { container } = render(<LeaveTimeline leaveId="leave-1" leave={leave} />);

    const items = Array.from(container.querySelectorAll("li"));
    expect(items.length).toBe(2);

    // First item: Request submitted has timestamp
    expect(items[0].textContent).toContain("Request submitted");

    // Second item: Parent approval shows approver name but no action timestamp
    expect(items[1].textContent).toContain("PARENT APPROVAL");
    expect(items[1].textContent).toContain("Neerasa Mohana Rao (Parent · 9391541081)");
    // Must NOT contain separator dot for timestamp
    const parentMeta = items[1].querySelector("p.text-caption");
    expect(parentMeta?.textContent).toBe("Neerasa Mohana Rao (Parent · 9391541081)");
  });

  it("places gate passes and movements downstream of the approval chain", () => {
    vi.mocked(useApprovalChain).mockReturnValue({
      approvals: [
        {
          id: "app-1",
          leaveRequestId: "leave-1",
          assignedApproverUserId: null,
          actedByUserId: null,
          approverRoleId: "role-admin",
          approverRoleCode: "ADMIN",
          approverName: "Admin",
          decision: "APPROVED",
          actedAt: "2026-10-23T04:05:00.000Z",
          comments: null,
          createdAt: "2026-10-23T04:00:00.000Z",
          stepOrder: 1,
          stepKey: "ADMIN_APPROVAL",
        },
      ] as any,
      total: 1,
      isLoading: false,
      isError: false,
      error: undefined,
      mutate: vi.fn(),
    });

    vi.mocked(useQrPasses).mockReturnValue({
      qrPasses: [
        {
          id: "qr-1",
          status: "ACTIVE",
          createdAt: "2026-10-23T04:06:00.000Z",
        },
      ],
      isLoading: false,
    } as any);

    vi.mocked(useMovement).mockReturnValue({
      movements: [
        {
          id: "mov-1",
          eventType: "EXIT_HOSTEL",
          createdAt: "2026-10-23T04:10:00.000Z",
        },
      ] as any,
      isLoading: false,
      isError: false,
      error: undefined,
      total: 1,
      mutate: vi.fn(),
    });

    const leave = {
      id: "leave-1",
      submittedAt: "2026-10-23T04:00:00.000Z",
    };

    const { container } = render(<LeaveTimeline leaveId="leave-1" leave={leave} />);

    const eventLabels = Array.from(container.querySelectorAll("li p.text-small")).map(
      (el) => el.textContent?.trim()
    );

    expect(eventLabels).toEqual([
      "Request submitted",
      "ADMIN APPROVAL",
      "Gate pass issued",
      "Left the hostel",
    ]);
  });
});
