// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FilterBar } from "@/components/shared/FilterBar";

const OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

describe("FilterBar", () => {
  it("renders with label and options", () => {
    render(<FilterBar label="Status" options={OPTIONS} value="" onChange={() => {}} />);

    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Active" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Inactive" })).toBeInTheDocument();
  });

  it("renders without label", () => {
    render(<FilterBar options={OPTIONS} value="" onChange={() => {}} />);

    expect(screen.queryByText("Status")).not.toBeInTheDocument();
  });

  it("calls onChange when option is selected", () => {
    const handleChange = vi.fn();
    render(<FilterBar options={OPTIONS} value="" onChange={handleChange} />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "active" } });

    expect(handleChange).toHaveBeenCalledWith("active");
  });
});
