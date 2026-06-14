// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "@/components/shared/StatusBadge";

describe("StatusBadge", () => {
  it("renders approved status", () => {
    render(<StatusBadge status="approved" />);
    const badge = screen.getByText("approved");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("text-emerald-600");
  });

  it("renders pending status", () => {
    render(<StatusBadge status="pending" />);
    const badge = screen.getByText("pending");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("text-amber-600");
  });

  it("renders rejected status", () => {
    render(<StatusBadge status="rejected" />);
    const badge = screen.getByText("rejected");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("text-red-600");
  });

  it("renders active status", () => {
    render(<StatusBadge status="active" />);
    const badge = screen.getByText("active");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("text-primary");
  });

  it("renders cancelled status", () => {
    render(<StatusBadge status="cancelled" />);
    const badge = screen.getByText("cancelled");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("text-muted-foreground");
  });

  it("renders completed status", () => {
    render(<StatusBadge status="completed" />);
    const badge = screen.getByText("completed");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("text-emerald-600");
  });

  it("renders auto_approved status with underscore replacement", () => {
    render(<StatusBadge status="auto_approved" />);
    expect(screen.getByText("auto approved")).toBeInTheDocument();
  });

  it("renders parent_approval status", () => {
    render(<StatusBadge status="parent_approval" />);
    const badge = screen.getByText("parent approval");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("text-violet-600");
  });
});
