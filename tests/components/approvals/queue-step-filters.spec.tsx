// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The step chips are a facet: the server counts them across the whole queue
 * with every filter applied except the waiting-on filter itself. These tests
 * pin that down — selecting a step must not change any chip's count, and must
 * not remove the steps it filtered out. Counting from the rendered page did
 * both, which is the regression this guards.
 */

const approvalsHook = vi.fn();
const extensionsHook = vi.fn();

vi.mock("swr", () => ({ default: () => ({ data: [] }) }));
vi.mock("@/features/leaves/hooks/use-leaves", () => ({
  useLeaveTypes: () => ({ leaveTypes: [] }),
}));
vi.mock("@/features/dashboard/hooks/use-dashboard-stats", () => ({
  useDashboardStats: () => ({ stats: null }),
}));
vi.mock("@/features/approvals/hooks/use-approvals", () => ({
  useApprovals: (args: unknown) => approvalsHook(args),
}));
vi.mock("@/features/extensions/hooks/use-approve-extension", () => ({
  useExtensionApprovals: (args: unknown) => extensionsHook(args),
}));
vi.mock("@/features/approvals/components/ApprovalCommandCard", () => ({
  ApprovalCommandCard: ({ item }: { item: { id: string } }) => <div>{item.id}</div>,
}));

import { ApprovalsPage } from "@/features/approvals/components/ApprovalsPage";
import { ExtensionApprovalsPage } from "@/features/extensions/components/ExtensionApprovalsPage";

const BREAKDOWN = [
  { stepKey: "PARENT_APPROVAL", count: 17 },
  { stepKey: "ADMIN_APPROVAL", count: 26 },
  { stepKey: "POC_APPROVAL", count: 9 },
];

const approvalsResult = (over: Record<string, unknown> = {}) => ({
  approvals: [],
  total: 52,
  totalPages: 3,
  stepBreakdown: BREAKDOWN,
  isLoading: false,
  mutate: vi.fn(),
  ...over,
});

const extensionsResult = (over: Record<string, unknown> = {}) => ({
  data: {
    items: [],
    total: 12,
    totalPages: 1,
    stats: { total: 30, pending: 12, approved: 10, rejected: 8 },
    stepBreakdown: [
      { stepKey: "ADMIN_APPROVAL", count: 6 },
      { stepKey: "PARENT_APPROVAL", count: 6 },
    ],
  },
  isLoading: false,
  mutate: vi.fn(),
  ...over,
});

const stepChips = () =>
  screen
    // queryAll, not getAll: a queue with nothing waiting renders no buttons.
    .queryAllByRole("button")
    .map((b) => b.textContent ?? "")
    .filter((t) => t.includes("Approval") && !t.includes("Pending Approvals"));

beforeAll(() => {
  // Radix Select needs these to open under jsdom.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});

let consoleErrors: string[] = [];
beforeEach(() => {
  consoleErrors = [];
  vi.spyOn(console, "error").mockImplementation((...args) => void consoleErrors.push(args.join(" ")));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ApprovalsPage step chips", () => {
  it("renders every step in the breakdown, ordered along the approval chain", () => {
    approvalsHook.mockReturnValue(approvalsResult());
    render(<ApprovalsPage />);

    const chips = stepChips();
    expect(chips).toEqual(["POC Approval9", "Admin Approval26", "Parent Approval17"]);
  });

  it("leaves every chip and count intact when one step is selected", () => {
    approvalsHook.mockReturnValue(approvalsResult());
    const { rerender } = render(<ApprovalsPage />);
    const before = stepChips();

    fireEvent.click(screen.getByText("Admin Approval"));
    // The server returns the same breakdown once waitingOn is set.
    approvalsHook.mockReturnValue(approvalsResult({ total: 26, totalPages: 2 }));
    rerender(<ApprovalsPage />);

    expect(stepChips()).toEqual(before);
    expect(approvalsHook).toHaveBeenLastCalledWith(
      expect.objectContaining({ waitingOn: "ADMIN_APPROVAL" }),
    );
  });

  it("sums the header count over the queue rather than the page", () => {
    approvalsHook.mockReturnValue(approvalsResult());
    render(<ApprovalsPage />);

    expect(screen.getByText("52 awaiting you")).toBeInTheDocument();
  });

  it("renders an empty breakdown without chips", () => {
    approvalsHook.mockReturnValue(approvalsResult({ total: 0, totalPages: 1, stepBreakdown: [] }));
    render(<ApprovalsPage />);

    expect(stepChips()).toEqual([]);
    expect(screen.getByText("Nothing waiting on you")).toBeInTheDocument();
  });

  it("counts client-side in the overdue view, which the API cannot express", () => {
    const overdue = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    approvalsHook.mockReturnValue(
      approvalsResult({
        approvals: [
          { id: "a1", decision: "PENDING", stepKey: "POC_APPROVAL", createdAt: overdue },
          { id: "a2", decision: "PENDING", stepKey: "POC_APPROVAL", createdAt: overdue },
        ],
      }),
    );
    render(<ApprovalsPage />);

    fireEvent.click(screen.getByText("Overdue"));

    expect(stepChips()).toEqual(["POC Approval2"]);
  });
});

describe("ApprovalsPage waiting-on filter", () => {
  it("offers every step in the breakdown", () => {
    approvalsHook.mockReturnValue(approvalsResult());
    render(<ApprovalsPage />);

    fireEvent.pointerDown(screen.getByText("Waiting On"), { pointerType: "mouse", button: 0 });

    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "All Steps",
      "POC Approval",
      "Admin Approval",
      "Parent Approval",
      "Completed",
    ]);
  });

  it("does not repeat Completed when a workflow defines a COMPLETE step", () => {
    approvalsHook.mockReturnValue(
      approvalsResult({
        stepBreakdown: [
          { stepKey: "ADMIN_APPROVAL", count: 4 },
          { stepKey: "COMPLETE", count: 2 },
        ],
      }),
    );
    render(<ApprovalsPage />);

    fireEvent.pointerDown(screen.getByText("Waiting On"), { pointerType: "mouse", button: 0 });

    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options.filter((o) => o === "Completed")).toHaveLength(1);
  });
});

describe("ExtensionApprovalsPage step cards", () => {
  it("renders both steps from the breakdown", () => {
    extensionsHook.mockReturnValue(extensionsResult());
    render(<ExtensionApprovalsPage />);

    expect(stepChips()).toEqual(["Admin Approval6", "Parent Approval6"]);
  });

  it("keeps both steps after one is selected", () => {
    extensionsHook.mockReturnValue(extensionsResult());
    const { rerender } = render(<ExtensionApprovalsPage />);
    const before = stepChips();

    fireEvent.click(screen.getByText("Admin Approval"));
    extensionsHook.mockReturnValue(
      extensionsResult({ data: { ...extensionsResult().data, total: 6 } }),
    );
    rerender(<ExtensionApprovalsPage />);

    expect(stepChips()).toEqual(before);
    expect(extensionsHook).toHaveBeenLastCalledWith(
      expect.objectContaining({ waitingOn: "ADMIN_APPROVAL" }),
    );
  });

  it("renders before the first response without crashing", () => {
    extensionsHook.mockReturnValue({ data: undefined, isLoading: true, mutate: vi.fn() });
    render(<ExtensionApprovalsPage />);

    expect(screen.getByText("Nothing waiting on you")).toBeInTheDocument();
  });
});

describe("both queues", () => {
  it("render without React errors", () => {
    approvalsHook.mockReturnValue(approvalsResult());
    extensionsHook.mockReturnValue(extensionsResult());

    render(<ApprovalsPage />);
    render(<ExtensionApprovalsPage />);

    expect(consoleErrors).toEqual([]);
  });
});
