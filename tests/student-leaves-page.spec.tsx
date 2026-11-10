// @vitest-environment jsdom
import { fireEvent, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

const mockUseRouter = vi.fn().mockReturnValue({ push: vi.fn() });
vi.mock("next/navigation", () => ({
  useRouter: () => mockUseRouter(),
}));

const mockUseLeaves = vi.fn();
vi.mock("@/features/leaves/hooks/use-leaves", () => ({
  useLeaves: (query?: any) => mockUseLeaves(query),
}));

import StudentLeavesPage from "@/app/(dashboard)/student/leaves/page";

describe("StudentLeavesPage — Phase 1 Performance Hardening", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseLeaves.mockReturnValue({
      leaves: [],
      total: 0,
      isLoading: false,
      isError: false,
      mutate: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("Debounce behavior (Objective 1)", () => {
    it("debounces search input by 300ms before triggering useLeaves revalidation", () => {
      render(<StudentLeavesPage />);

      // Initial call on mount with undefined search
      expect(mockUseLeaves).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 15,
          search: undefined,
          status: undefined,
        })
      );

      const input = screen.getByPlaceholderText("Search by leave type…");

      // User types "home"
      fireEvent.change(input, { target: { value: "home" } });

      // Immediate check: search input displays immediate value for typing responsiveness
      expect((input as HTMLInputElement).value).toBe("home");

      // At 100ms: useLeaves has NOT received "home" yet
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(mockUseLeaves).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: undefined })
      );

      // At 250ms: still within debounce window, no revalidation
      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(mockUseLeaves).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: undefined })
      );

      // At 300ms: timer fires, useLeaves is called with debounced search
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(mockUseLeaves).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 15,
          search: "home",
        })
      );
    });

    it("collapses rapid keystrokes into a single revalidation query", () => {
      render(<StudentLeavesPage />);
      const input = screen.getByPlaceholderText("Search by leave type…");

      // Rapidly type "m", "e", "d", "i", "c", "a", "l" within 50ms intervals
      const chars = ["m", "me", "med", "medi", "medic", "medica", "medical"];
      for (const val of chars) {
        fireEvent.change(input, { target: { value: val } });
        act(() => {
          vi.advanceTimersByTime(50);
        });
      }

      // None of the intermediate substrings triggered a search revalidation
      expect(mockUseLeaves).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: undefined })
      );

      // Allow the final 300ms timer to elapse
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Only the final complete string was requested
      expect(mockUseLeaves).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 15,
          search: "medical",
        })
      );
    });

    it("resets page to 1 when debounced search resolves", () => {
      // Simulate user already on page 3
      mockUseLeaves.mockReturnValue({
        leaves: Array.from({ length: 15 }).map((_, i) => ({
          id: `leave-${i}`,
          leaveTypeName: "Holiday",
          status: "APPROVED",
          startAt: "2026-06-01",
          endAt: "2026-06-05",
          createdAt: "2026-05-30",
        })),
        total: 45,
        isLoading: false,
        isError: false,
        mutate: vi.fn(),
      });

      render(<StudentLeavesPage />);

      // Switch to page 2 via pagination Next button
      const nextButton = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextButton);

      expect(mockUseLeaves).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 })
      );

      // Now start a search
      const input = screen.getByPlaceholderText("Search by leave type…");
      fireEvent.change(input, { target: { value: "vacation" } });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Page must reset to 1 on new search term
      expect(mockUseLeaves).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          search: "vacation",
        })
      );
    });

    it("clears search immediately when 'Clear filters' is clicked", () => {
      mockUseLeaves.mockReturnValue({
        leaves: [],
        total: 0,
        isLoading: false,
        isError: false,
        mutate: vi.fn(),
      });

      render(<StudentLeavesPage />);
      const input = screen.getByPlaceholderText("Search by leave type…");

      fireEvent.change(input, { target: { value: "nonexistent" } });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      const clearButton = screen.getByRole("button", { name: "Clear filters" });
      fireEvent.click(clearButton);

      expect((input as HTMLInputElement).value).toBe("");
      expect(mockUseLeaves).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          search: undefined,
          status: undefined,
        })
      );
    });
  });

  describe("Skeleton Geometry & CLS Mitigation (Objective 2)", () => {
    it("renders list skeleton matching the real list container geometry during loading", () => {
      mockUseLeaves.mockReturnValue({
        leaves: [],
        total: 0,
        isLoading: true,
        isError: false,
        mutate: vi.fn(),
      });

      render(<StudentLeavesPage />);

      const skeletonContainer = screen.getByTestId("leaves-skeleton");
      expect(skeletonContainer).toBeInTheDocument();

      // Geometry checks: verifies container matches the real <ul> container
      expect(skeletonContainer.className).toContain("divide-y");
      expect(skeletonContainer.className).toContain("divide-border");
      expect(skeletonContainer.className).toContain("overflow-hidden");
      expect(skeletonContainer.className).toContain("rounded-xl");
      expect(skeletonContainer.className).toContain("border");
      expect(skeletonContainer.className).toContain("border-border");
      expect(skeletonContainer.className).toContain("bg-surface");

      // Verify row items inside skeleton match the actual row layout
      const rows = skeletonContainer.children;
      expect(rows.length).toBe(5);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        expect(row.className).toContain("flex");
        expect(row.className).toContain("items-center");
        expect(row.className).toContain("gap-3.5");
        expect(row.className).toContain("px-5");
        expect(row.className).toContain("py-4");

        // First child is the 40x40 icon skeleton
        expect(row.children[0]!.className).toContain("h-10");
        expect(row.children[0]!.className).toContain("w-10");

        // Third child is the right-hand status badge skeleton (hidden on mobile)
        expect(row.children[2]!.className).toContain("rounded-full");
        expect(row.children[2]!.className).toContain("max-sm:hidden");
      }
    });

    it("renders actual list with exact matching classes once data arrives", () => {
      mockUseLeaves.mockReturnValue({
        leaves: [
          {
            id: "L1",
            leaveTypeName: "Holiday Leave",
            status: "APPROVED",
            startAt: "2026-06-01",
            endAt: "2026-06-05",
            createdAt: "2026-05-30",
          },
        ],
        total: 1,
        isLoading: false,
        isError: false,
        mutate: vi.fn(),
      });

      render(<StudentLeavesPage />);

      const list = screen.getByRole("list");
      expect(list).toBeInTheDocument();

      // Verified: container classes are identical to the skeleton container
      expect(list.className).toBe(
        "divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface"
      );

      const item = screen.getByRole("listitem");
      const anchor = item.querySelector("a");
      expect(anchor?.className).toContain("px-5");
      expect(anchor?.className).toContain("py-4");
      expect(screen.getByText("Holiday Leave")).toBeInTheDocument();
    });
  });

  describe("Status filter and pagination (Objective 4)", () => {
    it("updates status filter immediately and resets page to 1", () => {
      render(<StudentLeavesPage />);

      const statusSelect = screen.getByLabelText("Any status");
      fireEvent.change(statusSelect, { target: { value: "APPROVED" } });

      expect(mockUseLeaves).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          status: "APPROVED",
        })
      );
    });
  });
});
