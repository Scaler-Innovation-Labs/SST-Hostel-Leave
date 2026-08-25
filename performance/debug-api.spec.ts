/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { test } from "@playwright/test";

const BASE_URL = process.env.PERF_BASE_URL || "http://localhost:3000";

for (const path of ["/api/v1/badges", "/api/v1/overdue/count", "/api/v1/users"]) {
  test(`authed GET ${path}`, async ({ browser }) => {
    const context = await browser.newContext({
      storageState: "performance/.auth/admin.json",
    });
    const r = await context.request.get(`${BASE_URL}${path}`);
    const body = await r.text();
    console.log(`RESULT ${path} status=${r.status()} body=${body.slice(0, 150)}`);
    await context.close();
  });
}
