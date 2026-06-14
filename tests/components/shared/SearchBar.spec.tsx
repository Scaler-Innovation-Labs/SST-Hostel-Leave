// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SearchBar } from "@/components/shared/SearchBar";

describe("SearchBar", () => {
  it("renders with default placeholder", () => {
    render(<SearchBar value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("renders with custom placeholder", () => {
    render(<SearchBar value="" onChange={() => {}} placeholder="Find users..." />);
    expect(screen.getByPlaceholderText("Find users...")).toBeInTheDocument();
  });

  it("calls onChange immediately when controlled (value provided)", () => {
    const handleChange = vi.fn();
    render(<SearchBar value="" onChange={handleChange} />);
    const input = screen.getByPlaceholderText("Search...");
    fireEvent.change(input, { target: { value: "test" } });
    expect(handleChange).toHaveBeenCalledWith("test");
  });

  it("debounces onChange when uncontrolled (no value prop)", async () => {
    vi.useFakeTimers();
    const handleChange = vi.fn();
    render(<SearchBar onChange={handleChange} />);

    const input = screen.getByPlaceholderText("Search...");
    fireEvent.change(input, { target: { value: "test" } });

    // Should not fire immediately when uncontrolled
    expect(handleChange).not.toHaveBeenCalled();

    // Advance past the debounce delay (default 300ms)
    vi.advanceTimersByTime(300);
    expect(handleChange).toHaveBeenCalledWith("test");

    vi.useRealTimers();
  });

  it("updates internal value when external value changes", () => {
    const { rerender } = render(<SearchBar value="" onChange={() => {}} />);
    rerender(<SearchBar value="new value" onChange={() => {}} />);
    const input = screen.getByPlaceholderText("Search...") as HTMLInputElement;
    expect(input.value).toBe("new value");
  });

  it("applies custom className", () => {
    const { container } = render(<SearchBar value="" onChange={() => {}} className="custom-class" />);
    const input = container.querySelector("input");
    expect(input).toHaveClass("custom-class");
  });
});
