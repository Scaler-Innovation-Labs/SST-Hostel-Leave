// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InfoCard } from "@/components/shared/InfoCard";

describe("InfoCard", () => {
  it("renders label and value", () => {
    render(<InfoCard label="Students Active" value={42} />);

    expect(screen.getByText("Students Active")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders string value", () => {
    render(<InfoCard label="Status" value="Healthy" />);

    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
  });

  it("renders with custom icon", () => {
    render(
      <InfoCard
        label="Users"
        value={10}
        icon={<span data-testid="icon">icon</span>}
      />
    );

    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<InfoCard label="Test" value={1} className="custom-class" />);

    expect(container.firstChild).toHaveClass("custom-class");
  });
});
