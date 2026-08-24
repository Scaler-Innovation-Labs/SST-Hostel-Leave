/**
 * Playwright setup project: authenticate with Clerk and save browser state.
 *
 * Required env vars:
 *   PERF_TEST_EMAIL_ADMIN    — admin test account email
 *   PERF_TEST_PASSWORD_ADMIN — admin test account password
 *   PERF_TEST_EMAIL_STUDENT  — student test account email
 *   PERF_TEST_PASSWORD_STUDENT — student test account password
 *   PERF_TEST_EMAIL_SUPER_ADMIN — super-admin test account email
 *   PERF_TEST_PASSWORD_SUPER_ADMIN — super-admin test account password
 *
 * Storage states are saved to performance/.auth/{role}.json
 * and consumed by audit.spec.ts.
 */

import { expect, type Page,test as setup } from "@playwright/test";
import path from "path";

const AUTH_DIR = path.join(__dirname, ".auth");

type RoleCredentials = {
  role: string;
  email: string;
  password: string;
}

function getCredentials(): RoleCredentials[] {
  const credentials: RoleCredentials[] = [];

  const roles = ["admin", "student", "super-admin"] as const;
  for (const role of roles) {
    const envKey = role.toUpperCase().replace("-", "_");
    const email = process.env[`PERF_TEST_EMAIL_${envKey}`];
    const password = process.env[`PERF_TEST_PASSWORD_${envKey}`];

    if (email && password) {
      credentials.push({ role, email, password });
    }
  }

  return credentials;
}

async function authenticateWithClerk(
  page: Page,
  email: string,
  password: string,
  baseURL: string,
): Promise<void> {
  // Navigate to the login page
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });

  // Clerk sign-in form: look for the email input
  // Clerk renders its own UI, so we target their selectors
  const emailInput = page.locator('input[name="identifier"], input[type="email"], input[placeholder*="email" i]').first();
  await emailInput.waitFor({ state: "visible", timeout: 15_000 });
  await emailInput.fill(email);

  // Click the "Continue" / "Next" button
  const continueBtn = page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("Next")').first();
  await continueBtn.click();

  // Wait for password field to appear
  const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
  await passwordInput.waitFor({ state: "visible", timeout: 15_000 });
  await passwordInput.fill(password);

  // Submit the password
  const signInBtn = page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("Sign in")').first();
  await signInBtn.click();

  // Wait for redirect away from login (Clerk will redirect to the afterSignInUrl)
  // This typically goes to /redirect which then sends to the dashboard
  await page.waitForURL(
    (url) => !url.pathname.includes("/login") && !url.pathname.includes("/sign-in"),
    { timeout: 30_000 },
  );

  // Give the app a moment to fully load after redirect
  await page.waitForLoadState("networkidle");
}

const credentials = getCredentials();

if (credentials.length === 0) {
  console.warn(
    "\n⚠️  No PERF_TEST_EMAIL_* / PERF_TEST_PASSWORD_* env vars set.\n" +
    "   Auth setup will be skipped. Set credentials to enable authenticated audits.\n",
  );
}

for (const { role, email, password } of credentials) {
  setup(`authenticate as ${role}`, async ({ page, baseURL }) => {
    const safeBaseURL = baseURL ?? "http://localhost:3000";

    await authenticateWithClerk(page, email, password, safeBaseURL);

    // Verify we're authenticated by checking we're not on /login
    expect(page.url()).not.toContain("/login");

    // Save the storage state (cookies + localStorage)
    const storageStatePath = path.join(AUTH_DIR, `${role}.json`);
    await page.context().storageState({ path: storageStatePath });

    console.log(`✅ Saved auth state for ${role} → ${storageStatePath}`);
  });
}
