// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openMailto } from "@/lib/mailto";

describe("openMailto", () => {
  const originalOpen = window.open;

  beforeEach(() => {
    window.open = vi.fn();
  });

  afterEach(() => {
    window.open = originalOpen;
    vi.restoreAllMocks();
  });

  it("handles non-mailto links without throwing", () => {
    expect(() => openMailto("https://example.com")).not.toThrow();
  });

  it("opens Gmail compose in a new tab on desktop", () => {
    openMailto(
      "mailto:neerasa.24bcs10005@sst.scaler.com?subject=Bug%20Report%20-%20SST%20Hostel%20Leave"
    );

    expect(window.open).toHaveBeenCalledWith(
      "https://mail.google.com/mail/?view=cm&fs=1&to=neerasa.24bcs10005%40sst.scaler.com&su=Bug%20Report%20-%20SST%20Hostel%20Leave",
      "_blank",
      "noopener,noreferrer"
    );
  });
});
