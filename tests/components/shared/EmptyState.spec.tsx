// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/shared/EmptyState";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(<EmptyState title="No items found" description="Try adjusting your filters." />);

    expect(screen.getByText("No items found")).toBeInTheDocument();
    expect(screen.getByText("Try adjusting your filters.")).toBeInTheDocument();
  });

  it("renders without description", () => {
    render(<EmptyState title="Nothing here" />);

    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("renders action when provided", () => {
    render(
      <EmptyState
        title="No data"
        action={<button>Create</button>}
      />
    );

    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("renders custom icon", () => {
    render(
      <EmptyState
        title="Empty"
        icon={<span data-testid="custom-icon">icon</span>}
      />
    );

    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });
});
