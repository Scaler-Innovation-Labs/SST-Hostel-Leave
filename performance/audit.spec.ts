/**
 * Main performance audit test.
 *
 * Visits every route in the inventory, collects Web Vitals + API waterfalls,
 * and generates a ranked performance report.
 */

import { expect, type Page,test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

import { collectAllMetrics, createApiCollector } from "./collect-metrics";
import { buildReport, type RouteResult,writeReport } from "./report";
import { getRoutesForAudit, type Role,type RouteEntry } from "./routes";
import { CATEGORY_THRESHOLDS, evaluate, type Verdict,worstVerdict } from "./thresholds";

const AUTH_DIR = path.join(__dirname, ".auth");
const REPORTS_DIR = path.join(__dirname, "reports");
const RESULTS_PATH = path.join(REPORTS_DIR, "latest-results.jsonl");
const BASE_URL = process.env.PERF_BASE_URL || "http://localhost:3000";
const INCLUDE_DYNAMIC = process.env.PERF_TEST_DYNAMIC === "1";

function appendResult(result: RouteResult): void {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.appendFileSync(RESULTS_PATH, JSON.stringify(result) + "\n", "utf-8");
}

function readResults(): RouteResult[] {
  if (!fs.existsSync(RESULTS_PATH)) return [];
  return fs
    .readFileSync(RESULTS_PATH, "utf-8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as RouteResult);
}
/**
 * Audit a single route and return metrics + verdict.
 */
async function auditRoute(
  page: Page,
  route: RouteEntry,
): Promise<RouteResult> {
  const collector = createApiCollector(page);

  try {
    await page.goto(`${BASE_URL}${route.path}`, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });

    // Session-invalid guard: authenticated routes bounce to /login when no
    // (or expired) auth state is in use â€” those numbers would be garbage.
    const finalPath = new URL(page.url()).pathname;
    if (route.role !== "public" && finalPath.includes("/login")) {
      return {
        route,
        webVitals: { ttfb: 0, fcp: 0, lcp: 0, cls: 0, domContentLoaded: 0, load: 0 },
        apiRequests: [],
        jsBytes: 0,
        cssBytes: 0,
        domNodes: 0,
        verdict: "fail" as Verdict,
        error: "Redirected to /login â€” set PERF_TEST_EMAIL_*/PERF_TEST_PASSWORD_* for this role",
      };
    }

    // Wait a bit for any deferred rendering / LCP elements
    await page.waitForTimeout(2_000);

    // Collect Web Vitals
    const metrics = await collectAllMetrics(page);

    // Collect API waterfall
    const apiRequests = await collector.collect();

    // Evaluate against thresholds
    const thresholds = CATEGORY_THRESHOLDS[route.category];
    const verdicts: Verdict[] = [
      evaluate(metrics.webVitals.ttfb, thresholds.ttfb),
      evaluate(metrics.webVitals.fcp, thresholds.fcp),
      evaluate(metrics.webVitals.lcp, thresholds.lcp),
      evaluate(metrics.webVitals.cls, thresholds.cls),
    ];

    return {
      route,
      webVitals: metrics.webVitals,
      apiRequests,
      jsBytes: metrics.resources.jsBytes,
      cssBytes: metrics.resources.cssBytes,
      domNodes: metrics.resources.domNodes,
      verdict: worstVerdict(verdicts),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      route,
      webVitals: { ttfb: 0, fcp: 0, lcp: 0, cls: 0, domContentLoaded: 0, load: 0 },
      apiRequests: [],
      jsBytes: 0,
      cssBytes: 0,
      domNodes: 0,
      verdict: "fail" as Verdict,
      error: message,
    };
  }
}
/**
 * Get the storage state file path for a role, if it exists.
 */
function getStorageState(role: Role): string | undefined {
  const statePath = path.join(AUTH_DIR, `${role}.json`);
  if (fs.existsSync(statePath)) return statePath;
  return undefined;
}

/**
 * Create a test suite for a specific role.
 */
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
        const context = storageState
          ? await browser.newContext({ storageState })
          : await browser.newContext();
        const page = await context.newPage();

        const result = await auditRoute(page, route);
        appendResult(result);

        // Log the result
        if (result.error) {
          console.error(`'4c ${route.path}: ${result.error}`);
        } else {
          const icon = result.verdict === "pass" ? "âœ…" : result.verdict === "warn" ? "âš ï¸" : "âŒ";
          console.log(
            `${icon} ${route.path} | TTFB: ${result.webVitals.ttfb}ms | FCP: ${result.webVitals.fcp}ms | LCP: ${result.webVitals.lcp}ms | APIs: ${result.apiRequests.length}`,
          );
        }

        await context.close();

        // The page should not have errors (unless it redirected to login)
        if (!result.error) {
          expect(result.webVitals.ttfb).toBeGreaterThan(0);
        }
      });
    }
  });
}
// â”€â”€ Test Suites â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

createRoleSuite("public", "Public / Auth routes");
createRoleSuite("student", "Student routes");
createRoleSuite("admin", "Admin routes");
createRoleSuite("super-admin", "Super Admin routes");
createRoleSuite("poc", "POC routes");
createRoleSuite("guard", "Guard routes");

// â”€â”€ Report Generation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Generate the performance report after all routes have been audited.
 * Role suites stream results to a JSONL sidecar â€” this test reads them
 * and writes the Markdown/JSON reports (no re-browsing).
 */
test.describe("Report Generation", () => {
  test("generate performance report", async () => {
    const allResults = readResults();

    if (allResults.length === 0) {
      console.warn("No route results found â€” role suites produced no data.");
    }

    // Build and write the report
    const report = buildReport(allResults, BASE_URL);
    const { mdPath, jsonPath } = writeReport(report, REPORTS_DIR);

    console.log("");
    console.log("=".repeat(60));
    console.log("PERFORMANCE AUDIT COMPLETE");
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
    console.log("");

    // Print the summary table
    console.log("Route".padEnd(40) + "TTFB".padStart(8) + "FCP".padStart(8) + "LCP".padStart(8) + "Status");
    console.log("-".repeat(70));
    for (const r of allResults) {
      if (r.error) {
        console.log(r.route.path.padEnd(40) + "ERROR".padStart(8));
        continue;
      }
      const icon = r.verdict === "pass" ? "âœ…" : r.verdict === "warn" ? "âš ï¸" : "âŒ";
      console.log(
        r.route.path.padEnd(40) +
        (`${r.webVitals.ttfb}ms`).padStart(8) +
        (`${r.webVitals.fcp}ms`).padStart(8) +
        (`${r.webVitals.lcp}ms`).padStart(8) +
        " " + icon
      );
    }

    expect(allResults.length).toBeGreaterThan(0);
  });
});
