// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApprovalCountBadge } from "@/features/approvals/components/ApprovalCountBadge";

vi.mock("swr", () => ({
  default: vi.fn(),
}));

import useSWR from "swr";

const mockUseSWR = vi.mocked(useSWR);

function mockTotal(total: number) {
  mockUseSWR.mockReturnValue({ data: { data: { total } } } as never);
}

describe("ApprovalCountBadge", () => {
  beforeEach(() => {
    mockUseSWR.mockReset();
  });

  it("renders nothing while data has not loaded", () => {
    mockUseSWR.mockReturnValue({ data: undefined } as never);
    const { container } = render(<ApprovalCountBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when there are no pending approvals", () => {
    mockTotal(0);
    const { container } = render(<ApprovalCountBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the pending count as a pill", () => {
    mockTotal(7);
    render(<ApprovalCountBadge />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("caps the count at 99+", () => {
    mockTotal(150);
    render(<ApprovalCountBadge />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });
});
