/**
 * Report generator for the performance audit.
 *
 * Produces Markdown and JSON reports from collected route metrics.
 */

import * as fs from "fs";
import * as path from "path";

import type { ApiRequest } from "./collect-metrics";
import type { RouteEntry } from "./routes";
import { CATEGORY_THRESHOLDS, type Verdict,verdictEmoji } from "./thresholds";

// ── Types ──────────────────────────────────────────────────────

export type RouteResult = {
  route: RouteEntry;
  webVitals: {
    ttfb: number;
    fcp: number;
    lcp: number;
    cls: number;
    domContentLoaded: number;
    load: number;
  };
  /** 95th percentile across samples (nearest-rank). */
  webVitalsP95?: {
    ttfb: number;
    fcp: number;
    lcp: number;
    cls: number;
    domContentLoaded: number;
    load: number;
  };
  apiRequests: ApiRequest[];
  jsBytes: number;
  cssBytes: number;
  domNodes: number;
  verdict: Verdict;
  error?: string;
  /** Number of visits aggregated into this result (median of N samples). */
  samples?: number;
}

export type AuditReport = {
  timestamp: string;
  baseURL: string;
  totalRoutes: number;
  passed: number;
  warned: number;
  failed: number;
  results: RouteResult[];
}

// ── Formatting Helpers ─────────────────────────────────────────

function formatMs(ms: number): string {
  if (ms === 0) return "—";
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  return `${(ms / 1_000).toFixed(2)}s`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1_024) return `${bytes}B`;
  if (bytes < 1_024 * 1024) return `${(bytes / 1_024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function padLeft(s: string, len: number): string {
  return s.length >= len ? s : " ".repeat(len - s.length) + s;
}

// ── Markdown Report ────────────────────────────────────────────

export function generateMarkdown(report: AuditReport): string {
  const lines: string[] = [];

  lines.push(`# Performance Audit — ${report.timestamp}`);
  lines.push("");
  lines.push(`**Base URL:** \`${report.baseURL}\``);
  lines.push("");

  // ── Summary ──
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Count |");
  lines.push("|--------|------:|");
  lines.push(`| Routes tested | ${report.totalRoutes} |`);
  lines.push(`| ${verdictEmoji("pass")} Passing | ${report.passed} |`);
  lines.push(`| ${verdictEmoji("warn")} Warning | ${report.warned} |`);
  lines.push(`| ${verdictEmoji("fail")} Failing | ${report.failed} |`);
  const errored = report.results.filter((r) => r.error).length;
  if (errored > 0) {
    lines.push(`| ❌ Errored | ${errored} |`);
  }
  lines.push("");

  // ── Page Performance Table ──
  lines.push("## Page Performance");
  lines.push("");
  lines.push(
    `| Route | Role | TTFB p50 | TTFB p95 | FCP p50 | LCP p50 | LCP p95 | CLS | JS | API # | Status |`
  );
  lines.push(
    `|-------|:----:|-----:|-----:|----:|----:|----:|----:|---:|------:|:------:|`
  );

  for (const result of report.results) {
    if (result.error) {
      lines.push(
        `| ${result.route.path} | ${result.route.role} | — | — | — | — | — | — | — | — | ❌ Error |`
      );
      continue;
    }

    const { webVitals, webVitalsP95, jsBytes, apiRequests, verdict } = result;
    const lcpP95 = webVitalsP95?.lcp ?? webVitals.lcp;
    const ttfbP95 = webVitalsP95?.ttfb ?? webVitals.ttfb;
    lines.push(
      `| ${result.route.path} ` +
        `| ${result.route.role} ` +
        `| ${padLeft(formatMs(webVitals.ttfb), 6)} ` +
        `| ${padLeft(formatMs(ttfbP95), 6)} ` +
        `| ${padLeft(formatMs(webVitals.fcp), 6)} ` +
        `| ${padLeft(formatMs(webVitals.lcp), 6)} ` +
        `| ${padLeft(formatMs(lcpP95), 6)} ` +
        `| ${padLeft(webVitals.cls.toFixed(3), 5)} ` +
        `| ${padLeft(formatBytes(jsBytes), 7)} ` +
        `| ${padLeft(String(apiRequests.length), 5)} ` +
        `| ${verdictEmoji(verdict)} |`
    );
  }
  lines.push("");

  // ── Slowest Routes (by LCP p95) ──
  const sorted = [...report.results]
    .filter((r) => !r.error)
    .sort(
      (a, b) =>
        (b.webVitalsP95?.lcp ?? b.webVitals.lcp) -
        (a.webVitalsP95?.lcp ?? a.webVitals.lcp)
    );

  if (sorted.length > 0) {
    lines.push("## Slowest Routes (by LCP p95)");
    lines.push("");
    lines.push("| Rank | Route | LCP p50 | LCP p95 | TTFB p50 | Verdict |");
    lines.push("|-----:|-------|----:|----:|-----:|:-------:|");

    sorted.slice(0, 15).forEach((r, i) => {
      lines.push(
        `| ${i + 1} ` +
          `| ${r.route.path} ` +
          `| ${formatMs(r.webVitals.lcp)} ` +
          `| ${formatMs(r.webVitalsP95?.lcp ?? r.webVitals.lcp)} ` +
          `| ${formatMs(r.webVitals.ttfb)} ` +
          `| ${verdictEmoji(r.verdict)} |`
      );
    });
    lines.push("");
  }

  // ── API Waterfalls ──
  const routesWithApis = report.results.filter(
    (r) => r.apiRequests.length > 0 && !r.error,
  );

  if (routesWithApis.length > 0) {
    lines.push("## API Waterfalls");
    lines.push("");

    for (const result of routesWithApis) {
      lines.push(`### ${result.route.path}`);
      lines.push("");
      lines.push("| Endpoint | Method | Status | Duration | Size |");
      lines.push("|----------|-------:|-------:|---------:|-----:|");

      for (const api of result.apiRequests) {
        const slow = api.duration > 1_000 ? " 🔴" : api.duration > 500 ? " 🟡" : "";
        lines.push(
          `| ${api.shortUrl} ` +
            `| ${api.method} ` +
            `| ${api.status} ` +
            `| ${padLeft(formatMs(api.duration), 8)}${slow} ` +
            `| ${padLeft(formatBytes(api.size), 8)} |`,
        );
      }
      lines.push("");
    }
  }

  // ── Bottleneck Analysis ──
  lines.push("## Bottleneck Analysis");
  lines.push("");

  const slowApis: Array<{ route: string; api: ApiRequest }> = [];
  for (const result of report.results) {
    for (const api of result.apiRequests) {
      if (api.duration > 500) {
        slowApis.push({ route: result.route.path, api });
      }
    }
  }
  slowApis.sort((a, b) => b.api.duration - a.api.duration);

  if (slowApis.length > 0) {
    lines.push("### Slowest API Endpoints (>500ms)");
    lines.push("");
    lines.push("| Page | Endpoint | Duration |");
    lines.push("|------|----------|---------:|");
    for (const { route, api } of slowApis.slice(0, 20)) {
      lines.push(
        `| ${route} | ${api.shortUrl} | ${formatMs(api.duration)} |`,
      );
    }
    lines.push("");
  } else {
    lines.push("No API endpoints exceeded 500ms. ✅");
    lines.push("");
  }

  // ── Errors ──
  const erroredResults = report.results.filter((r) => r.error);
  if (erroredResults.length > 0) {
    lines.push("## Errors");
    lines.push("");
    for (const r of erroredResults) {
      lines.push(`- **${r.route.path}**: ${r.error}`);
    }
    lines.push("");
  }

  // ── Recommendations ──
  lines.push("## Recommendations");
  lines.push("");

  const failingRoutes = report.results.filter(
    (r) => r.verdict === "fail" && !r.error,
  );
  if (failingRoutes.length > 0) {
    lines.push("### Priority 1: Fix Failing Routes");
    lines.push("");
    for (const r of failingRoutes) {
      const thresholds = CATEGORY_THRESHOLDS[r.route.category];
      const issues: string[] = [];
      if (r.webVitals.ttfb > thresholds.ttfb) {
        issues.push(
          `TTFB ${formatMs(r.webVitals.ttfb)} (target: ${formatMs(thresholds.ttfb)})`,
        );
      }
      if (r.webVitals.fcp > thresholds.fcp) {
        issues.push(
          `FCP ${formatMs(r.webVitals.fcp)} (target: ${formatMs(thresholds.fcp)})`,
        );
      }
      if (r.webVitals.lcp > thresholds.lcp) {
        issues.push(
          `LCP ${formatMs(r.webVitals.lcp)} (target: ${formatMs(thresholds.lcp)})`,
        );
      }
      if (issues.length > 0) {
        lines.push(`- **${r.route.path}**: ${issues.join(", ")}`);
      }
    }
    lines.push("");
  }

  const warnRoutes = report.results.filter(
    (r) => r.verdict === "warn" && !r.error,
  );
  if (warnRoutes.length > 0) {
    lines.push("### Priority 2: Investigate Warnings");
    lines.push("");
    for (const r of warnRoutes) {
      lines.push(`- **${r.route.path}** (${r.route.category})`);
    }
    lines.push("");
  }

  if (failingRoutes.length === 0 && warnRoutes.length === 0 && erroredResults.length === 0) {
    lines.push("All tested routes meet their thresholds. 🎉");
    lines.push("");
  }

  lines.push("---");
  lines.push("*Generated by performance audit runner*");

  return lines.join("\n");
}

// ── JSON Report ────────────────────────────────────────────────

export function buildReport(
  results: RouteResult[],
  baseURL: string,
): AuditReport {
  const counted = results.filter((r) => !r.error);
  return {
    timestamp: new Date().toISOString(),
    baseURL,
    totalRoutes: results.length,
    passed: counted.filter((r) => r.verdict === "pass").length,
    warned: counted.filter((r) => r.verdict === "warn").length,
    failed: counted.filter((r) => r.verdict === "fail").length,
    results,
  };
}

export function generateJson(report: AuditReport): string {
  return JSON.stringify(report, null, 2);
}

// ── File Output ────────────────────────────────────────────────

export function writeReport(
  report: AuditReport,
  outputDir: string,
): { mdPath: string; jsonPath: string } {
  fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const mdPath = path.join(outputDir, `performance-${timestamp}.md`);
  const jsonPath = path.join(outputDir, `performance-${timestamp}.json`);
  const latestMdPath = path.join(outputDir, "performance-latest.md");
  const latestJsonPath = path.join(outputDir, "performance-latest.json");

  const md = generateMarkdown(report);
  const json = generateJson(report);

  fs.writeFileSync(mdPath, md, "utf-8");
  fs.writeFileSync(jsonPath, json, "utf-8");
  fs.writeFileSync(latestMdPath, md, "utf-8");
  fs.writeFileSync(latestJsonPath, json, "utf-8");

  return { mdPath, jsonPath };
}
