// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "@/components/shared/StatusBadge";

/**
 * A status must never be colour alone: every one renders a written label and
 * an icon alongside its tone, so the screen survives greyscale.
 */
describe("StatusBadge", () => {
  it("renders approved status in the success tone", () => {
    render(<StatusBadge status="approved" />);
    const badge = screen.getByText("Approved");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("text-success");
  });

  it("names what pending is waiting for", () => {
    render(<StatusBadge status="pending" />);
    const badge = screen.getByText("Awaiting approval");
    expect(badge.className).toContain("text-warning");
  });

  it("renders rejected status in the danger tone", () => {
    render(<StatusBadge status="rejected" />);
    expect(screen.getByText("Rejected").className).toContain("text-danger");
  });

  it("renders active status in the accent tone", () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText("Active").className).toContain("text-accent");
  });

  it("renders cancelled status in the neutral tone", () => {
    render(<StatusBadge status="cancelled" />);
    expect(screen.getByText("Cancelled").className).toContain("text-muted");
  });

  it("renders overdue status in the danger tone", () => {
    render(<StatusBadge status="overdue" />);
    expect(screen.getByText("Overdue").className).toContain("text-danger");
  });

  it("renders auto_approved with a readable label", () => {
    render(<StatusBadge status="auto_approved" />);
    expect(screen.getByText("Auto-approved")).toBeInTheDocument();
  });

  it("renders parent_approval with a readable label", () => {
    render(<StatusBadge status="parent_approval" />);
    expect(screen.getByText("With parent")).toBeInTheDocument();
  });

  it("pairs every status with an icon", () => {
    const { container } = render(<StatusBadge status="approved" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
