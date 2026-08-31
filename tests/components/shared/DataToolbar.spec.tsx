// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataToolbar } from "@/components/shared/DataToolbar";

describe("DataToolbar", () => {
  it("renders search input when search props are provided", () => {
    render(<DataToolbar searchValue="" onSearchChange={() => {}} />);
    expect(screen.getByPlaceholderText("Search…")).toBeInTheDocument();
  });

  it("hides search input when search props are omitted", () => {
    render(<DataToolbar />);
    expect(screen.queryByPlaceholderText("Search…")).not.toBeInTheDocument();
  });

  it("renders custom search placeholder", () => {
    render(<DataToolbar searchValue="" onSearchChange={() => {}} searchPlaceholder="Find items..." />);
    expect(screen.getByPlaceholderText("Find items...")).toBeInTheDocument();
  });

  it("calls onSearchChange when typing in search", () => {
    const handleChange = vi.fn();
    render(<DataToolbar searchValue="" onSearchChange={handleChange} />);
    const input = screen.getByPlaceholderText("Search…");
    fireEvent.change(input, { target: { value: "test" } });
    expect(handleChange).toHaveBeenCalledWith("test");
  });

  it("renders filters when provided", () => {
    render(
      <DataToolbar
        filters={[
          {
            key: "status",
            label: "All Status",
            options: [
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ],
            value: "",
            onChange: () => {},
          },
        ]}
      />,
    );
    expect(screen.getByLabelText("All Status")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Active" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Inactive" })).toBeInTheDocument();
  });

  it("calls filter onChange when filter is changed", () => {
    const handleFilterChange = vi.fn();
    render(
      <DataToolbar
        filters={[
          {
            key: "status",
            label: "All Status",
            options: [{ value: "active", label: "Active" }],
            value: "",
            onChange: handleFilterChange,
          },
        ]}
      />,
    );
    const select = screen.getByLabelText("All Status");
    fireEvent.change(select, { target: { value: "active" } });
    expect(handleFilterChange).toHaveBeenCalledWith("active");
  });

  it("displays the total count when provided", () => {
    render(<DataToolbar total={42} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/results/)).toBeInTheDocument();
  });

  it("uses the singular for a total of one", () => {
    const { container } = render(<DataToolbar total={1} />);
    expect(container.textContent).toContain("1 result");
    expect(container.textContent).not.toContain("results");
  });

  it("names the counted thing when given one", () => {
    const { container } = render(
      <DataToolbar total={3} noun="leave request" />,
    );
    expect(container.textContent).toContain("leave requests");
  });

  it("says the count is filtered when a filter is active", () => {
    const { container } = render(
      <DataToolbar
        total={10}
        filters={[
          {
            key: "status",
            label: "Status",
            options: [],
            value: "active",
            onChange: () => {},
          },
        ]}
      />,
    );
    expect(container.textContent).toContain("matching your filters");
  });

  it("does not claim filtering when no filter is active", () => {
    const { container } = render(<DataToolbar total={10} />);
    expect(container.textContent).not.toContain("matching your filters");
  });
});
