import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./performance",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 1,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PERF_BASE_URL || "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts$/,
    },
    {
      name: "audit",
      testMatch: /audit\.spec\.ts$/,
      dependencies: ["setup"],
    },
  ],
  outputDir: "./performance/test-results",
});
