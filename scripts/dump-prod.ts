/**
 * Dump the production database to a local file.
 *
 * Reads DATABASE_URL from .env.production (AWS RDS via PgBouncer or direct).
 *
 * Usage:
 *   # Dump with a timestamped filename
 *   pnpm db:dump-prod
 *
 *   # Dump to a specific file
 *   pnpm db:dump-prod prod-snapshot-2026-10-30.dump
 *
 * ⚠️  IMPORTANT: If your production DATABASE_URL goes through PgBouncer
 * (port 6432), pg_dump works best against the direct PostgreSQL endpoint
 * (typically port 5432). If pg_dump fails through PgBouncer, find the direct
 * RDS endpoint in the AWS Console (RDS > Databases > your instance > Endpoint)
 * and set DATABASE_URL in .env.production to that host:5432 before running.
 *
 * The production password is read from DATABASE_URL — never hardcode it here.
 * The dump file is gitignored (*.dump, *.backup, prod-*.sql).
 *
 * If the Postgres client tools are not installed on the host, the dump runs
 * inside the Postgres container image instead, so no local install is needed.
 */

import { execFileSync, execSync } from "child_process";
import * as dotenv from "dotenv";
import * as fs from "fs";

import {
  hasCommand,
  LOCAL_POSTGRES_IMAGE,
} from "./pg-cli";

dotenv.config({ path: ".env.production" });

const raw = process.env.DATABASE_URL;

if (!raw) {
  console.error("DATABASE_URL is not set in .env.production");
  process.exit(1);
}

const dumpFile =
  process.argv[2] ?? `prod-snapshot-${new Date().toISOString().slice(0, 10)}.dump`;

const url = new URL(raw);
const host = url.hostname;
const port = url.port || "5432";
const user = url.username;
const database = url.pathname.replace(/^\//, "");
const password = url.password;

const isPgBouncer = port === "6432";

console.log("=== Production Database Dump ===");
console.log(`Host: ${host}`);
console.log(`Port: ${port}`);
console.log(`Database: ${database}`);
console.log(`User: ${user}`);
console.log(`Output: ${dumpFile}`);
console.log("");

if (isPgBouncer) {
  console.warn("⚠️  WARNING: Connecting through PgBouncer (port 6432).");
  console.warn("   pg_dump may fail or produce an incomplete dump.");
  console.warn("   For best results, use the direct RDS PostgreSQL endpoint (port 5432).");
  console.warn("   See the AWS Console: RDS > Databases > Endpoint");
  console.log("");
}

if (!password) {
  console.error("No password found in DATABASE_URL. pg_dump will prompt interactively.");
}

const env = { ...process.env };
if (password) {
  env.PGPASSWORD = password;
}

// PgBouncer in transaction mode doesn't support all pg_dump features, so
// --no-owner is dropped only from the direct-endpoint invocation.
const pgDumpArgs = [
  "-h",
  host,
  "-p",
  port,
  "-U",
  user,
  "-d",
  database,
  "-Fc",
  "--no-owner",
];

console.log("Running pg_dump...");
try {
  if (hasCommand("pg_dump")) {
    execSync(
      `pg_dump ${pgDumpArgs.map((a) => `"${a}"`).join(" ")} -f "${dumpFile}"`,
      { env: isPgBouncer ? { ...env, PGSSLMODE: "prefer" } : env, stdio: "inherit" }
    );
  } else {
    // No host pg_dump: run the same tool from the Postgres image and write
    // its stdout straight to the dump file.
    console.log(
      `pg_dump not found on PATH — using the ${LOCAL_POSTGRES_IMAGE} container instead.`
    );
    const out = fs.openSync(dumpFile, "w");
    try {
      execFileSync(
        "docker",
        [
          "run",
          "--rm",
          "-e",
          "PGPASSWORD",
          LOCAL_POSTGRES_IMAGE,
          "pg_dump",
          ...pgDumpArgs,
        ],
        { env, stdio: ["ignore", out, "inherit"] }
      );
    } finally {
      fs.closeSync(out);
    }
  }

  const size = fs.statSync(dumpFile).size;
  console.log("");
  console.log(`✅ Dump complete: ${dumpFile} (${(size / 1024).toFixed(0)} KB)`);
  console.log("");
  console.log("Next step — restore into local Docker:");
  console.log(`  pnpm db:restore-prod ${dumpFile}`);
} catch (error) {
  console.error("");
  console.error("❌ pg_dump failed.");
  if (isPgBouncer) {
    console.error("   This is likely because PgBouncer (port 6432) doesn't support");
    console.error("   all pg_dump operations. Use the direct RDS endpoint (port 5432) instead.");
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
