/**
 * Metric collection utilities for the performance audit.
 *
 * Uses Playwright's page.evaluate to read Performance Observer data
 * and page.on('response') to track API waterfalls.
 */

import type { Page, Response } from "@playwright/test";

import { MONITORED_API_PATTERNS } from "./routes";

// ── Types ──────────────────────────────────────────────────────

export type WebVitals = {
  /** Time to First Byte (ms) — from Navigation Timing */
  ttfb: number;
  /** First Contentful Paint (ms) */
  fcp: number;
  /** Largest Contentful Paint (ms) */
  lcp: number;
  /** Cumulative Layout Shift (unitless) */
  cls: number;
  /** DOM Content Loaded (ms) */
  domContentLoaded: number;
  /** Load event (ms) */
  load: number;
}

export type ApiRequest = {
  url: string;
  /** Short path for display (e.g., /api/v1/dashboard/stats) */
  shortUrl: string;
  /** HTTP method */
  method: string;
  /** Response status */
  status: number;
  /** Response time (ms) */
  duration: number;
  /** Response body size (bytes) — estimated from content-length or body */
  size: number;
}

export type ResourceSummary = {
  /** Total JS transfer (bytes) */
  jsBytes: number;
  /** Total CSS transfer (bytes) */
  cssBytes: number;
  /** Total HTML size (bytes) */
  htmlBytes: number;
  /** Number of API requests */
  apiRequestCount: number;
  /** Number of DOM nodes */
  domNodes: number;
}

export type RouteMetrics = {
  webVitals: WebVitals;
  apiRequests: ApiRequest[];
  resources: ResourceSummary;
}

// ── Collection ─────────────────────────────────────────────────

/**
 * Collect Web Vitals from the browser's Performance Observer API.
 * Must be called after the page has loaded.
 */
export async function collectWebVitals(page: Page): Promise<WebVitals> {
  const vitals = await page.evaluate(() => {
    const nav = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;

    // TTFB: responseStart - requestStart (or fetchStart as fallback)
    const ttfb = nav
      ? nav.responseStart - nav.requestStart
      : 0;

    // DOM Content Loaded & Load
    const domContentLoaded = nav ? nav.domContentLoadedEventEnd - nav.fetchStart : 0;
    const load = nav ? nav.loadEventEnd - nav.fetchStart : 0;

    // FCP from paint entries
    const paintEntries = performance.getEntriesByType("paint");
    const fcpEntry = paintEntries.find((e) => e.name === "first-contentful-paint");
    const fcp = fcpEntry ? fcpEntry.startTime : 0;

    // CLS from layout-shift entries (if available)
    let cls = 0;
    const layoutShifts = performance.getEntriesByType(
      "layout-shift",
    ) as PerformanceEntry[];
    for (const entry of layoutShifts) {
      const shift = entry as unknown as { hadRecentInput: boolean; value: number };
      if (!shift.hadRecentInput) {
        cls += shift.value;
      }
    }

    // LCP from largest-contentful-paint (if PerformanceObserver supported)
    let lcp = 0;
    const lcpEntries = performance.getEntriesByType(
      "largest-contentful-paint",
    ) as PerformanceEntry[];
    if (lcpEntries.length > 0) {
      const lastLcp = lcpEntries[lcpEntries.length - 1];
      lcp = lastLcp ? lastLcp.startTime : 0;
    }

    return { ttfb, fcp, lcp, cls, domContentLoaded, load };
  });

  // Fallback: if LCP wasn't available via PerformanceObserver, try via a delayed read
  if (vitals.lcp === 0) {
    const lcpFallback = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let observed = 0;
        try {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const last = entries[entries.length - 1];
            if (last) observed = last.startTime;
          });
          observer.observe({ type: "largest-contentful-paint", buffered: true });
        } catch {
          // not supported
        }
        // Give it a moment to collect, then return what we have
        setTimeout(() => {
          resolve(observed);
        }, 2_000);
      });
    });
    vitals.lcp = lcpFallback;
  }

  return vitals;
}

/**
 * Collect DOM node count from the page.
 */
export async function collectDomNodes(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelectorAll("*").length);
}

/**
 * Set up network monitoring to capture API requests.
 * Returns a collector function — call it after page load to get results.
 */
export function createApiCollector(page: Page): {
  collect: () => Promise<ApiRequest[]>;
} {
  const captured: Array<{
    url: string;
    method: string;
    status: number;
    startTime: number;
    endTime: number;
    size: number;
  }> = [];

  const requestStarts = new Map<string, number>();

  page.on("request", (request) => {
    const url = request.url();
    if (isMonitoredApi(url)) {
      requestStarts.set(url, Date.now());
    }
  });

  page.on("response", async (response: Response) => {
    const url = response.url();
    if (!isMonitoredApi(url)) return;

    const startTime = requestStarts.get(url) ?? Date.now();
    const endTime = Date.now();

    let size = 0;
    try {
      const headers = response.headers();
      const contentLength = headers["content-length"];
      if (contentLength) {
        size = parseInt(contentLength, 10);
      } else {
        // Estimate from body
        const body = await response.body();
        size = body.length;
      }
    } catch {
      // Response body may not be available (e.g., redirected)
    }

    captured.push({
      url,
      method: response.request().method(),
      status: response.status(),
      startTime,
      endTime,
      size,
    });
  });

  return {
    collect: async () => {
      // Sort by start time for waterfall order
      captured.sort((a, b) => a.startTime - b.startTime);

      return captured.map((r) => ({
        url: r.url,
        shortUrl: shortenUrl(r.url),
        method: r.method,
        status: r.status,
        duration: r.endTime - r.startTime,
        size: r.size,
      }));
    },
  };
}

/**
 * Collect all metrics for a page visit.
 */
export async function collectAllMetrics(page: Page): Promise<RouteMetrics> {
  const [webVitals, domNodes] = await Promise.all([
    collectWebVitals(page),
    collectDomNodes(page),
  ]);

  // Estimate resource sizes from performance entries
  const resourceSummary = await page.evaluate(() => {
    const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    let jsBytes = 0;
    let cssBytes = 0;
    let htmlBytes = 0;

    for (const entry of entries) {
      const transferSize = entry.transferSize || 0;
      if (entry.initiatorType === "script") {
        jsBytes += transferSize;
      } else if (entry.initiatorType === "css" || entry.name.endsWith(".css")) {
        cssBytes += transferSize;
      } else if (entry.name.endsWith(".html") || entry.initiatorType === "document") {
        htmlBytes += transferSize;
      }
    }

    return { jsBytes, cssBytes, htmlBytes };
  });

  return {
    webVitals,
    apiRequests: [], // Filled in by the caller using the collector
    resources: {
      ...resourceSummary,
      apiRequestCount: 0,
      domNodes,
    },
  };
}

// ── Helpers ────────────────────────────────────────────────────

function isMonitoredApi(url: string): boolean {
  try {
    const parsed = new URL(url);
    return MONITORED_API_PATTERNS.some((pattern) =>
      parsed.pathname.startsWith(pattern),
    );
  } catch {
    return false;
  }
}

function shortenUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return url;
  }
}
