/**
 * LCP diagnostic probe — profiles a single route and dumps:
 *   - navigation timings (domInteractive, DCL, load)
 *   - FCP/LCP with the actual LCP element (tag + text snippet)
 *   - render-blocking resources in <head>
 *   - slowest resources by start time
 *
 * Usage:
 *   npx playwright test performance/debug-lcp.spec.ts --project=audit \
 *     --grep "probe" 2>&1
 */

import { expect, test } from "@playwright/test";

const BASE_URL = process.env.PERF_BASE_URL || "http://localhost:3000";
const PATHS = (process.env.PERF_PROBE_PATHS ?? "/,/login")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

for (const routePath of PATHS) {
  test(`probe ${routePath}`, async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Isolate external-dependency impact: abort Clerk JS + noise texture
    if (process.env.PERF_BLOCK_EXTERNAL === "1") {
      await context.route(/clerk\.accounts\.dev|grainy-gradients\.vercel\.app/, (r) =>
        r.abort()
      );
    }

    await page.goto(`${BASE_URL}${routePath}`, {
      waitUntil: "load",
      timeout: 60_000,
    });
    await page.waitForTimeout(3_000);

    const diag = await page.evaluate(async () => {
      const nav = performance.getEntriesByType(
        "navigation"
      )[0] as PerformanceNavigationTiming | undefined;

      const paints = performance.getEntriesByType("paint");
      const fcp =
        paints.find((p) => p.name === "first-contentful-paint")?.startTime ?? 0;

      // LCP requires PerformanceObserver — getEntriesByType is unreliable.
      const lcpPromise = new Promise<{ time: number; el: string }>((resolve) => {
        try {
          const obs = new PerformanceObserver((list) => {
            const entries = list.getEntries() as unknown as Array<
              PerformanceEntry & { element?: Element; url?: string }
            >;
            const last = entries[entries.length - 1];
            if (!last) return;
            const el = last.element;
            let desc = "";
            if (el) {
              desc = `${el.tagName.toLowerCase()}${
                el.className ? "." + String(el.className).split(" ").slice(0, 3).join(".") : ""
              } :: ${(el.textContent ?? "").trim().slice(0, 60)}`;
            } else if (last.url) {
              desc = `RESOURCE ${last.url.slice(0, 80)}`;
            }
            resolve({ time: Math.round(last.startTime), el: desc });
          });
          obs.observe({
            type: "largest-contentful-paint",
            buffered: true,
          } as PerformanceObserverInit);
        } catch {
          resolve({ time: 0, el: "unsupported" });
        }
        setTimeout(() => resolve({ time: 0, el: "timeout" }), 2500);
      });

      // Long tasks >50ms — main-thread blocks that delay first paint
      let longTasks: Array<{ start: number; dur: number }> = [];
      try {
        new PerformanceObserver(() => {}).observe({ type: "longtask", buffered: true } as PerformanceObserverInit);
      } catch {}
      longTasks = (
        performance.getEntriesByType("longtask") as unknown as Array<
          PerformanceEntry & { attribution?: unknown }
        >
      )
        .map((t) => ({ start: Math.round(t.startTime), dur: Math.round(t.duration) }))
        .sort((a, b) => b.dur - a.dur)
        .slice(0, 10);

      // Scripts/CSS in head that could block rendering
      const blocking: string[] = [];
      document.querySelectorAll("head script, head link[rel=stylesheet]").forEach((n) => {
        const s = n as HTMLScriptElement;
        if (n.tagName === "SCRIPT" && !s.async && !s.defer && s.src) {
          blocking.push(`SYNC-SCRIPT ${s.src.slice(0, 110)}`);
        }
        if (n.tagName === "LINK") {
          blocking.push(`CSS ${s.getAttribute("href")?.slice(0, 110)}`);
        }
      });

      // Slowest resources
      const res = (
        performance.getEntriesByType(
          "resource"
        ) as PerformanceResourceTiming[]
      )
        .map((r) => ({
          name: r.name,
          type: r.initiatorType,
          start: Math.round(r.startTime),
          dur: Math.round(r.duration),
          size: r.transferSize,
        }))
        .sort((a, b) => b.start - a.start)
        .slice(0, 12);

      const lcpResult = await lcpPromise;

      return {
        ttfb: nav ? Math.round(nav.responseStart - nav.requestStart) : 0,
        domInteractive: nav ? Math.round(nav.domInteractive - nav.fetchStart) : 0,
        domContentLoaded: nav
          ? Math.round(nav.domContentLoadedEventEnd - nav.fetchStart)
          : 0,
        loadEvent: nav ? Math.round(nav.loadEventEnd - nav.fetchStart) : 0,
        fcp: Math.round(fcp),
        lcp: lcpResult.time,
        lcpEl: lcpResult.el,
        longTasks,
        blocking,
        latestResources: res,
      };
    });

    console.log(`\n===== PROBE ${routePath} =====`);
    console.log(JSON.stringify(diag, null, 1));
    await context.close();

    expect(diag.fcp).toBeGreaterThan(0);
  });
}
