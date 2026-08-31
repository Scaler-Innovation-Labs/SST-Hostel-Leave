import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

/**
 * tailwind-merge only knows the scales it is told about. Left at its defaults
 * it classifies `text-body` as a colour (it is not a t-shirt size), so a later
 * `text-muted` deletes it — and `text-on-fill` on a filled control disappears
 * the same way, which is how invisible button labels ship.
 */
describe("cn", () => {
  it("keeps a named type step and a colour together", () => {
    expect(cn("text-body", "text-muted")).toBe("text-body text-muted");
  });

  it("keeps the label colour on a filled control", () => {
    expect(cn("bg-success", "text-on-fill", "text-caption")).toBe(
      "bg-success text-on-fill text-caption"
    );
  });

  it("resolves a conflict within the type scale", () => {
    expect(cn("text-body", "text-h1")).toBe("text-h1");
  });

  it("resolves a conflict within the colour scale", () => {
    expect(cn("text-ink", "text-muted")).toBe("text-muted");
  });

  it("treats density spacing as spacing", () => {
    expect(cn("p-card", "p-6")).toBe("p-6");
  });

  it("resolves the elevation ladder", () => {
    expect(cn("shadow-raised", "shadow-glow")).toBe("shadow-glow");
  });

  it("resolves the motion steps", () => {
    expect(cn("duration-fast", "duration-base")).toBe("duration-base");
    expect(cn("duration-fast", "duration-200")).toBe("duration-200");
  });

  it("keeps a gradient and a background colour together", () => {
    expect(cn("bg-scaler-depth", "bg-surface")).toBe(
      "bg-scaler-depth bg-surface"
    );
  });

  it("resolves the radius ladder", () => {
    expect(cn("rounded-md", "rounded-2xl")).toBe("rounded-2xl");
  });
});
