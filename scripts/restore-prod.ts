/**
 * Restore a production dump into your local Docker PostgreSQL.
 *
 * Reads DATABASE_URL from .env.local (localhost:5432).
 *
 * Usage:
 *   pnpm db:restore-prod prod-snapshot-2026-10-30.dump
 *   pnpm db:restore-prod prod-snapshot-2026-10-30.dump --yes
 *
 * This will:
 *   1. Drop and recreate the public schema (clean slate)
 *   2. pg_restore the dump into the local DB
 *   3. Run Drizzle migrations to bring the schema up to date
 *
 * ⚠️  This replaces ALL local data. Make sure you don't need anything
 *    currently in your local Docker DB.
 *
 * The dump file is gitignored (*.dump, *.backup, prod-*.sql).
 * Never commit dump files to Git — they contain real production data.
 *
 * If the Postgres client tools are not installed on the host, the restore is
 * executed inside the running Postgres container instead.
 */

import { execFileSync, execSync } from "child_process";
import * as dotenv from "dotenv";
import * as fs from "fs";

import { hasCommand, LOCAL_POSTGRES_SERVICE } from "./pg-cli";

/** Waits for Enter. Refuses to run unattended: dropping the schema should not
 *  happen just because a piped stdin happened to close. */
async function confirmDestructiveRestore(skipPrompt: boolean): Promise<boolean> {
  if (skipPrompt) return true;

  if (!process.stdin.isTTY) {
    console.error("❌ No interactive terminal for confirmation.");
    console.error("   Re-run in a terminal, or pass --yes to skip the prompt.");
    return false;
  }

  console.log("⚠️  WARNING: This will destroy all data in your local Docker DB.");
  console.log("   Press Enter to continue, or Ctrl+C to cancel...");

  await new Promise<void>((resolve) => {
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", () => resolve());
  });

  return true;
}

async function main(): Promise<void> {
  dotenv.config({ path: ".env.local" });

  const raw = process.env.DATABASE_URL;

  if (!raw) {
    console.error("DATABASE_URL is not set in .env.local");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const skipPrompt = args.includes("--yes");
  const dumpFile = args.find((arg) => !arg.startsWith("--"));

  if (!dumpFile) {
    console.error("Usage: pnpm db:restore-prod <dump-file> [--yes]");
    console.error(
      "Example: pnpm db:restore-prod prod-snapshot-2026-10-30.dump"
    );
    process.exit(1);
  }

  if (!fs.existsSync(dumpFile)) {
    console.error(`Dump file not found: ${dumpFile}`);
    process.exit(1);
  }

  const url = new URL(raw);
  const host = url.hostname;
  const port = url.port || "5432";
  const user = url.username;
  const password = url.password;
  const database = url.pathname.replace(/^\//, "");

  console.log("=== Restore Production Dump to Local Docker ===");
  console.log(`Target: ${host}:${port}/${database} (user: ${user})`);
  console.log(`Dump file: ${dumpFile}`);
  console.log("");

  // Safety check: confirm we're targeting localhost, not production
  const isLocalhost = host === "localhost" || host === "127.0.0.1";
  if (!isLocalhost) {
    console.error("❌ Refusing to restore into a non-localhost database.");
    console.error(`   Target host: ${host}`);
    console.error("   This script is for local Docker only — never restore into AWS.");
    process.exit(1);
  }

  const confirmed = await confirmDestructiveRestore(skipPrompt);
  if (!confirmed) {
    console.error("Aborted — nothing was changed.");
    process.exit(1);
  }

  const env = { ...process.env };
  if (password) {
    env.PGPASSWORD = password;
  }

  const useHostTools = hasCommand("psql") && hasCommand("pg_restore");

  if (!useHostTools) {
    console.log(
      "psql/pg_restore not found on PATH — running inside the Postgres container."
    );
    console.log("");
  }

  // Inside the container the server always listens on 5432 and is reached over
  // its loopback interface, regardless of the host-side mapped port.
  const hostConn = [`-h`, host, `-p`, port, `-U`, user, `-d`, database];
  const dockerConn = [`-h`, "127.0.0.1", `-p`, "5432", `-U`, user, `-d`, database];

  const runPsql = (sql: string): void => {
    if (useHostTools) {
      execFileSync("psql", [...hostConn, "-c", sql], { env, stdio: "inherit" });
      return;
    }
    execFileSync(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "-e",
        "PGPASSWORD",
        LOCAL_POSTGRES_SERVICE,
        "psql",
        ...dockerConn,
        "-c",
        sql,
      ],
      { env, stdio: "inherit" }
    );
  };

  const runRestore = (): void => {
    if (useHostTools) {
      execFileSync(
        "pg_restore",
        [...hostConn, "--clean", "--if-exists", "--no-owner", "-v", dumpFile],
        { env, stdio: "inherit" }
      );
      return;
    }

    // pg_restore reads the custom-format archive from stdin when given no
    // file argument, so the dump never has to be copied into the container.
    const input = fs.openSync(dumpFile, "r");
    try {
      execFileSync(
        "docker",
        [
          "compose",
          "exec",
          "-T",
          "-e",
          "PGPASSWORD",
          LOCAL_POSTGRES_SERVICE,
          "pg_restore",
          ...dockerConn,
          "--clean",
          "--if-exists",
          "--no-owner",
        ],
        { env, stdio: [input, "inherit", "inherit"] }
      );
    } finally {
      fs.closeSync(input);
    }
  };

  try {
    // Step 1: Drop and recreate the public schema
    console.log("\n📋 Dropping and recreating public schema...");
    runPsql("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");

    // Step 2: pg_restore the dump
    console.log("\n📋 Restoring dump into local Docker...");
    runRestore();

    // Step 3: Run Drizzle migrations to ensure schema is up to date.
    // NODE_ENV is pinned so the child loads .env.local (development) no matter
    // what the parent shell exports — migrate.ts picks its env file from it.
    console.log("\n📋 Running Drizzle migrations...");
    execSync("npx tsx scripts/migrate.ts", {
      env: { ...env, NODE_ENV: "development" },
      stdio: "inherit",
    });

    console.log("\n✅ Restore complete!");
    console.log("   Your local Docker DB now contains a copy of production data.");
    console.log("   Start the app with: pnpm dev");
  } catch (error) {
    console.error("\n❌ Restore failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("❌ Restore failed:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
