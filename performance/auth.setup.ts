/**
 * Playwright setup project: authenticate perf-test users and save state.
 *
 * The production /login page is a custom Google-only button, so we drive
 * Clerk's JS API programmatically instead of automating UI forms:
 *   signIn.create({ identifier, password })  → attemptFirstFactor
 * then persist cookies/localStorage to performance/.auth/{role}.json.
 *
 * Identifiers are USERNAMES (this Clerk instance has email sign-in
 * disabled). Created by scripts/create-perf-test-users.ts.
 *
 * Required env vars:
 *   PERF_TEST_EMAIL_ADMIN      — admin username
 *   PERF_TEST_PASSWORD_ADMIN   — admin password
 *   PERF_TEST_EMAIL_STUDENT    — student username
 *   PERF_TEST_PASSWORD_STUDENT — student password
 *   PERF_TEST_EMAIL_SUPER_ADMIN — super-admin username
 *   PERF_TEST_PASSWORD_SUPER_ADMIN — super-admin password
 */

import { expect, type Page,test as setup } from "@playwright/test";
import path from "path";

const AUTH_DIR = path.join(__dirname, ".auth");

type RoleCredentials = {
  role: string;
  identifier: string;
  password: string;
};

function getCredentials(): RoleCredentials[] {
  const credentials: RoleCredentials[] = [];

  const roles = ["admin", "student", "super-admin"] as const;
  for (const role of roles) {
    const envKey = role.toUpperCase().replace("-", "_");
    const identifier = process.env[`PERF_TEST_EMAIL_${envKey}`];
    const password = process.env[`PERF_TEST_PASSWORD_${envKey}`];

    if (identifier && password) {
      credentials.push({ role, identifier, password });
    }
  }

  return credentials;
}

/**
 * Sign in through Clerk's JS API — bypasses the custom Google-only login
 * surface while producing a real, fully-valid browser session.
 */
async function authenticateWithClerk(
  page: Page,
  identifier: string,
  password: string,
  baseURL: string,
): Promise<void> {
  // Load any app route so ClerkProvider mounts and window.Clerk appears.
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });

  await page.waitForFunction(() => {
    const clerk = (
      window as unknown as { Clerk?: { loaded?: boolean } }
    ).Clerk;
    return Boolean(clerk?.loaded);
  }, undefined, { timeout: 20_000 });

  const status = await page.evaluate(
    async ({ identifier, password }) => {
      const clerk = (
        window as unknown as {
          Clerk: {
            client: {
              signIn: {
                create(input: {
                  identifier: string;
                  password: string;
                }): Promise<{
                  status: string;
                  createdSessionId?: string;
                  supportedFirstFactors?: Array<{ strategy: string }>;
                  supportedSecondFactors?: Array<{ strategy: string }>;
                }>;
                attemptFirstFactor(input: {
                  strategy: string;
                  password: string;
                }): Promise<{
                  status: string;
                  createdSessionId?: string;
                  supportedSecondFactors?: Array<{ strategy: string }>;
                }>;
                prepareSecondFactor?(input: {
                  strategy: string;
                }): Promise<{ status: string }>;
                attemptSecondFactor?(input: {
                  strategy: string;
                  code: string;
                }): Promise<{
                  status: string;
                  createdSessionId?: string;
                }>;
              };
            };
            setActive(input: { session: string | null }): Promise<void>;
          };
        }
      ).Clerk;

      const signIn = clerk.client.signIn;

      let created;
      try {
        created = await signIn.create({ identifier, password });
      } catch (e) {
        return `create failed: ${(e as Error).message}`;
      }

      // Password-only flow completes on create when the instance has no
      // second factor / device-trust step.
      if (created.status === "complete" && created.createdSessionId) {
        await clerk.setActive({ session: created.createdSessionId });
        return "complete";
      }

      let attempt;
      try {
        attempt = await signIn.attemptFirstFactor({
          strategy: "password",
          password,
        });
      } catch (e) {
        return (
          `first-factor failed: ${(e as Error).message} | ` +
          `create.status=${created.status} ` +
          `first-factors=${JSON.stringify(created.supportedFirstFactors ?? [])}`
        );
      }

      if (attempt.status === "complete" && attempt.createdSessionId) {
        await clerk.setActive({ session: attempt.createdSessionId });
        return "complete";
      }

      if (
        attempt.status === "needs_second_factor" &&
        typeof signIn.prepareSecondFactor === "function" &&
        typeof signIn.attemptSecondFactor === "function"
      ) {
        try {
          await signIn.prepareSecondFactor({ strategy: "email_code" });
        } catch (e) {
          return `prepare-second failed: ${(e as Error).message}`;
        }
        try {
          const second = await signIn.attemptSecondFactor({
            strategy: "email_code",
            code: "424242",
          });
          if (second.status === "complete" && second.createdSessionId) {
            await clerk.setActive({ session: second.createdSessionId });
            return "complete";
          }
          return `second-factor incomplete: ${second.status}`;
        } catch (e) {
          return `second-factor failed: ${(e as Error).message}`;
        }
      }

      return (
        `sign-in incomplete: ${attempt.status}. ` +
        `create-factors=${JSON.stringify(created.supportedSecondFactors ?? [])}; ` +
        `attempt-factors=${JSON.stringify(attempt.supportedSecondFactors ?? [])}`
      );
    },
    { identifier, password }
  );

  if (status !== "complete") {
    throw new Error(`Clerk sign-in failed for ${identifier}: ${status}`);
  }

  // Land on an app route so the freshly-active session hydrates.
  await page.goto(`${baseURL}/redirect`, { waitUntil: "networkidle" });
}

const credentials = getCredentials();

if (credentials.length === 0) {
  console.warn(
    "\n⚠️  No PERF_TEST_EMAIL_* / PERF_TEST_PASSWORD_* env vars set.\n" +
      "   Auth setup will be skipped. Set credentials to enable authenticated audits.\n"
  );
}

for (const { role, identifier, password } of credentials) {
  setup(`authenticate as ${role}`, async ({ page, baseURL }) => {
    const safeBaseURL = baseURL ?? "http://localhost:3000";

    await authenticateWithClerk(page, identifier, password, safeBaseURL);

    // Verify we're authenticated by checking we're not on /login
    expect(page.url()).not.toContain("/login");

    // Save the storage state (cookies + localStorage)
    const storageStatePath = path.join(AUTH_DIR, `${role}.json`);
    await page.context().storageState({ path: storageStatePath });

    console.log(`✅ Saved auth state for ${role} → ${storageStatePath}`);
  });
}
