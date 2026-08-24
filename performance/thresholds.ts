/**
 * Performance thresholds per route category.
 *
 * Based on targets from performance.md:
 * - Dashboard:  TTFB < 800ms, LCP < 2.5s
 * - CRUD:       TTFB < 500ms, LCP < 2.0s
 * - Analytics:  TTFB < 1.0s, LCP < 3.0s
 * - Scanner:    TTFB < 300ms, LCP < 1.5s (latency-critical)
 * - Auth:       TTFB < 500ms, LCP < 2.0s
 */

import type { RouteCategory } from "./routes";

export type Thresholds = {
  /** Time to First Byte (ms) */
  ttfb: number;
  /** First Contentful Paint (ms) */
  fcp: number;
  /** Largest Contentful Paint (ms) */
  lcp: number;
  /** Interaction to Next Paint (ms) */
  inp: number;
  /** Cumulative Layout Shift (unitless) */
  cls: number;
}

export const CATEGORY_THRESHOLDS: Record<RouteCategory, Thresholds> = {
  auth: {
    ttfb: 500,
    fcp: 1_500,
    lcp: 2_000,
    inp: 200,
    cls: 0.1,
  },
  dashboard: {
    ttfb: 800,
    fcp: 1_800,
    lcp: 2_500,
    inp: 200,
    cls: 0.1,
  },
  crud: {
    ttfb: 500,
    fcp: 1_500,
    lcp: 2_000,
    inp: 200,
    cls: 0.1,
  },
  analytics: {
    ttfb: 1_000,
    fcp: 2_000,
    lcp: 3_000,
    inp: 200,
    cls: 0.1,
  },
  scanner: {
    ttfb: 300,
    fcp: 1_000,
    lcp: 1_500,
    inp: 100,
    cls: 0.1,
  },
  profile: {
    ttfb: 500,
    fcp: 1_500,
    lcp: 2_000,
    inp: 200,
    cls: 0.1,
  },
  settings: {
    ttfb: 500,
    fcp: 1_500,
    lcp: 2_000,
    inp: 200,
    cls: 0.1,
  },
  api: {
    ttfb: 500,
    fcp: 0,
    lcp: 0,
    inp: 0,
    cls: 0,
  },
};

export type Verdict = "pass" | "warn" | "fail";

/**
 * Evaluate a metric against the threshold for a given category.
 * Returns "fail" if exceeds 2x threshold, "warn" if exceeds 1x, else "pass".
 */
export function evaluate(
  value: number,
  threshold: number,
): Verdict {
  if (threshold === 0) return "pass"; // not applicable
  if (value > threshold * 2) return "fail";
  if (value > threshold) return "warn";
  return "pass";
}

/**
 * Get the worst verdict across all metrics for a route.
 */
export function worstVerdict(verdicts: Verdict[]): Verdict {
  if (verdicts.includes("fail")) return "fail";
  if (verdicts.includes("warn")) return "warn";
  return "pass";
}

/**
 * Format a verdict as an emoji indicator.
 */
export function verdictEmoji(v: Verdict): string {
  switch (v) {
    case "pass":
      return "🟢";
    case "warn":
      return "🟡";
    case "fail":
      return "🔴";
  }
}
