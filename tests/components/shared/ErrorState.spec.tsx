// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ErrorState } from "@/components/shared/ErrorState";

describe("ErrorState", () => {
  it("renders default message", () => {
    render(<ErrorState />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders custom message", () => {
    render(<ErrorState message="Failed to load data" />);

    expect(screen.getByText("Failed to load data")).toBeInTheDocument();
  });

  it("renders retry button when onRetry is provided", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Error" onRetry={onRetry} />);

    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("does not render retry button without onRetry", () => {
    render(<ErrorState message="Error" />);

    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });
});
