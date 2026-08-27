/**
 * Main performance audit test.
 *
 * Visits every route in the inventory PERF_SAMPLES times (default 1),
 * reports median Web Vitals + worst-case API waterfalls, and generates a
 * ranked performance report.
 */

import { expect, type Page,test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

import { type ApiRequest,collectAllMetrics, createApiCollector } from "./collect-metrics";
import { buildReport, type RouteResult, writeReport } from "./report";
import { getRoutesForAudit, type Role, type RouteEntry } from "./routes";
import { CATEGORY_THRESHOLDS, evaluate, type Verdict, worstVerdict } from "./thresholds";

const AUTH_DIR = path.join(__dirname, ".auth");
const REPORTS_DIR = path.join(__dirname, "reports");
const RESULTS_PATH = path.join(REPORTS_DIR, "latest-results.jsonl");
const BASE_URL = process.env.PERF_BASE_URL || "http://localhost:3000";
const INCLUDE_DYNAMIC = process.env.PERF_TEST_DYNAMIC === "1";
/** Visits per route — metrics reported as median, APIs as worst-case. */
const SAMPLES = Math.max(1, Number(process.env.PERF_SAMPLES ?? "1"));

if (process.env.PERF_RESET_RESULTS !== "0") {
  fs.rmSync(RESULTS_PATH, { force: true });
}

function median(values: number[]): number {
  return percentile(values, 50);
}

/** Nearest-rank percentile. */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    s.length - 1,
    Math.max(0, Math.ceil((p / 100) * s.length) - 1)
  );
  return s[idx]!;
}

function appendResult(result: RouteResult): void {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.appendFileSync(RESULTS_PATH, JSON.stringify(result) + "\n", "utf-8");
}

function readResults(): RouteResult[] {
  if (!fs.existsSync(RESULTS_PATH)) return [];
  const lines = fs
    .readFileSync(RESULTS_PATH, "utf-8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as RouteResult);

  // Dedupe by role+path keeping the best entry (retries and re-runs of
  // individual suites append; transient DNS/network errors lose to data).
  const byKey = new Map<string, RouteResult>();
  for (const r of lines) {
    const key = `${r.route.role}:${r.route.path}`;
    const prev = byKey.get(key);
    if (!prev || (prev.error && !r.error)) {
      byKey.set(key, r);
    }
  }
  return [...byKey.values()];
}

type SampleMetrics = Omit<RouteResult, "route" | "verdict">;

/**
 * One page visit — raw metrics for a single sample.
 */
async function sampleRoute(
  page: Page,
  route: RouteEntry
): Promise<SampleMetrics> {
  const collector = createApiCollector(page);

  try {
    await page.goto(`${BASE_URL}${route.path}`, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });

    // Session-invalid guard: authenticated routes bounce to /login when no
    // (or expired) auth state is in use — those numbers would be garbage.
    const finalPath = new URL(page.url()).pathname;
    if (route.role !== "public" && finalPath.includes("/login")) {
      return {
        webVitals: { ttfb: 0, fcp: 0, lcp: 0, cls: 0, domContentLoaded: 0, load: 0 },
        apiRequests: [],
        jsBytes: 0,
        cssBytes: 0,
        domNodes: 0,
        error:
          "Redirected to /login — set PERF_TEST_EMAIL_*/PERF_TEST_PASSWORD_* for this role",
        samples: 1,
      };
    }

    // Wait for deferred rendering / LCP elements to settle
    await page.waitForTimeout(2_000);

    const metrics = await collectAllMetrics(page);
    const apiRequests = await collector.collect();

    return {
      webVitals: metrics.webVitals,
      apiRequests,
      jsBytes: metrics.resources.jsBytes,
      cssBytes: metrics.resources.cssBytes,
      domNodes: metrics.resources.domNodes,
      samples: 1,
    };
  } catch (err) {
    return {
      webVitals: { ttfb: 0, fcp: 0, lcp: 0, cls: 0, domContentLoaded: 0, load: 0 },
      apiRequests: [],
      jsBytes: 0,
      cssBytes: 0,
      domNodes: 0,
      error: err instanceof Error ? err.message : String(err),
      samples: 1,
    };
  }
}

/**
 * Audit a route with SAMPLES visits. Metrics are medians across samples;
 * API waterfall keeps the worst-case duration per endpoint (bottleneck view).
 */
async function auditRoute(page: Page, route: RouteEntry): Promise<RouteResult> {
  const samples: SampleMetrics[] = [];

  for (let i = 0; i < SAMPLES; i++) {
    const s = await sampleRoute(page, route);
    samples.push(s);
    if (s.error) break; // no point sampling a broken/expired route
  }

  const first = samples[0]!;
  if (first.error) {
    return {
      route,
      webVitals: first.webVitals,
      apiRequests: [],
      jsBytes: 0,
      cssBytes: 0,
      domNodes: 0,
      verdict: "fail" as Verdict,
      error: first.error,
      samples: samples.length,
    };
  }

  // Worst-case API waterfall per endpoint across all samples
  const worstApis = new Map<string, ApiRequest>();
  for (const s of samples) {
    for (const api of s.apiRequests) {
      const key = `${api.method} ${api.shortUrl}`;
      const prev = worstApis.get(key);
      if (!prev || api.duration > prev.duration) {
        worstApis.set(key, api);
      }
    }
  }

  const thresholds = CATEGORY_THRESHOLDS[route.category];
  const verdicts: Verdict[] = [
    evaluate(median(samples.map((s) => s.webVitals.ttfb)), thresholds.ttfb),
    evaluate(median(samples.map((s) => s.webVitals.fcp)), thresholds.fcp),
    evaluate(median(samples.map((s) => s.webVitals.lcp)), thresholds.lcp),
    evaluate(median(samples.map((s) => s.webVitals.cls)), thresholds.cls),
  ];

  const pick = (key: keyof SampleMetrics["webVitals"]) =>
    samples.map((s) => s.webVitals[key]);

  return {
    route,
    webVitals: {
      ttfb: median(pick("ttfb")),
      fcp: median(pick("fcp")),
      lcp: median(pick("lcp")),
      cls: median(pick("cls")),
      domContentLoaded: median(pick("domContentLoaded")),
      load: median(pick("load")),
    },
    webVitalsP95: {
      ttfb: percentile(pick("ttfb"), 95),
      fcp: percentile(pick("fcp"), 95),
      lcp: percentile(pick("lcp"), 95),
      cls: percentile(pick("cls"), 95),
      domContentLoaded: percentile(pick("domContentLoaded"), 95),
      load: percentile(pick("load"), 95),
    },
    apiRequests: [...worstApis.values()].sort((a, b) => b.duration - a.duration),
    jsBytes: Math.max(...samples.map((s) => s.jsBytes)),
    cssBytes: Math.max(...samples.map((s) => s.cssBytes)),
    domNodes: Math.max(...samples.map((s) => s.domNodes)),
    verdict: worstVerdict(verdicts),
    samples: samples.length,
  };
}

function getStorageState(role: Role): string | undefined {
  const statePath = path.join(AUTH_DIR, `${role}.json`);
  if (fs.existsSync(statePath)) return statePath;
  return undefined;
}

function createRoleSuite(role: Role, label: string) {
  const routes = getRoutesForAudit(role, INCLUDE_DYNAMIC);

  if (routes.length === 0) {
    test.skip(`No routes to audit for ${label}`, () => {});
    return;
  }

  test.describe(label, () => {
    const storageState = getStorageState(role);

    for (const route of routes) {
      test(`${route.path} [${route.category}]`, async ({ browser }) => {
        // N samples per route can exceed the default 60s budget
        test.setTimeout(SAMPLES > 1 ? 600_000 : 60_000);

        const context = storageState
          ? await browser.newContext({ storageState })
          : await browser.newContext();
        const page = await context.newPage();

        const result = await auditRoute(page, route);
        appendResult(result);

        if (result.error) {
          console.log(`ERROR ${route.path}: ${result.error}`);
        } else {
          const icon =
            result.verdict === "pass" ? "PASS" : result.verdict === "warn" ? "WARN" : "FAIL";
          console.log(
            `[${icon}] ${route.path} (${result.samples ?? 1}x) | ` +
              `TTFB ${Math.round(result.webVitals.ttfb)}/${Math.round(
                result.webVitalsP95?.ttfb ?? 0
              )}ms | ` +
              `LCP ${Math.round(result.webVitals.lcp)}/${Math.round(
                result.webVitalsP95?.lcp ?? 0
              )}ms | ` +
              `APIs ${result.apiRequests.length}`
          );
          expect(result.webVitals.ttfb).toBeGreaterThan(0);
        }

        await context.close();
      });
    }
  });
}

// ── Test Suites ────────────────────────────────────────────────

createRoleSuite("public", "Public / Auth routes");
createRoleSuite("student", "Student routes");
createRoleSuite("admin", "Admin routes");
createRoleSuite("super-admin", "Super Admin routes");
createRoleSuite("poc", "POC routes");
createRoleSuite("guard", "Guard routes");

// ── Report Generation ──────────────────────────────────────────

test.describe("Report Generation", () => {
  test("generate performance report", async () => {
    const allResults = readResults();

    if (allResults.length === 0) {
      console.warn("No route results found — role suites produced no data.");
    }

    const report = buildReport(allResults, BASE_URL);
    const { mdPath, jsonPath } = writeReport(report, REPORTS_DIR);

    console.log("");
    console.log("=".repeat(60));
    console.log(`PERFORMANCE AUDIT COMPLETE (${SAMPLES} sample(s)/route)`);
    console.log("=".repeat(60));
    console.log("");
    console.log(`Total routes: ${report.totalRoutes}`);
    console.log(`Passed: ${report.passed}`);
    console.log(`Warnings: ${report.warned}`);
    console.log(`Failures: ${report.failed}`);
    const errored = allResults.filter((r) => r.error).length;
    if (errored > 0) {
      console.log(`Errored: ${errored} (see report Errors section)`);
    }
    console.log("");
    console.log(`Markdown report: ${mdPath}`);
    console.log(`JSON report: ${jsonPath}`);

    expect(allResults.length).toBeGreaterThan(0);
  });
});
