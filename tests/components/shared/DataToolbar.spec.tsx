// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataToolbar } from "@/components/shared/DataToolbar";

describe("DataToolbar", () => {
  it("renders search input when search props are provided", () => {
    render(<DataToolbar searchValue="" onSearchChange={() => {}} />);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("hides search input when search props are omitted", () => {
    render(<DataToolbar />);
    expect(screen.queryByPlaceholderText("Search...")).not.toBeInTheDocument();
  });

  it("renders custom search placeholder", () => {
    render(<DataToolbar searchValue="" onSearchChange={() => {}} searchPlaceholder="Find items..." />);
    expect(screen.getByPlaceholderText("Find items...")).toBeInTheDocument();
  });

  it("calls onSearchChange when typing in search", () => {
    const handleChange = vi.fn();
    render(<DataToolbar searchValue="" onSearchChange={handleChange} />);
    const input = screen.getByPlaceholderText("Search...");
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

  it("displays total count when provided", () => {
    render(<DataToolbar total={42} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("results found")).toBeInTheDocument();
  });

  it("displays singular 'result' for total of 1", () => {
    render(<DataToolbar total={1} />);
    expect(screen.getByText("result found")).toBeInTheDocument();
  });

  it("shows filtered indicator when filters are active", () => {
    render(
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
    expect(screen.getByText("(filtered)")).toBeInTheDocument();
  });

  it("does not show filtered indicator when no filters are active", () => {
    render(<DataToolbar total={10} />);
    expect(screen.queryByText("(filtered)")).not.toBeInTheDocument();
  });
});
