// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useDocuments } from "@/hooks/use-documents";

describe("useDocuments", () => {
  it("returns empty array when leaveId is undefined", () => {
    // SWR won't fetch when key is null
    const { result } = renderHook(() => useDocuments(undefined));

    expect(result.current.documents).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it("mutate function is callable", () => {
    // SWR's mutate should be a function
    const { result } = renderHook(() => useDocuments("leave-1"));
    expect(typeof result.current.mutate).toBe("function");
  });

  it("returns stable return shape regardless of leaveId", () => {
    // Verify the hook's return shape is stable
    const { result } = renderHook(() => useDocuments(undefined));

    expect(result.current).toHaveProperty("documents");
    expect(result.current).toHaveProperty("isLoading");
    expect(result.current).toHaveProperty("isError");
    expect(result.current).toHaveProperty("error");
    expect(result.current).toHaveProperty("mutate");
    expect(Array.isArray(result.current.documents)).toBe(true);
  });

  it("defaults documents to empty array when data is undefined", () => {
    // Hook returns empty array even before fetch completes
    const { result } = renderHook(() => useDocuments("leave-1"));
    expect(result.current.documents).toEqual([]);
    expect(result.current.isError).toBe(false);
  });
});
