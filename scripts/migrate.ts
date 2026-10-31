import * as dotenv from "dotenv";

type NodeEnv = "development" | "staging" | "production";

const envFileMap: Record<NodeEnv, string> = {
  development: ".env.local",
  staging: ".env.staging",
  production: ".env.production",
};

const nodeEnv = (process.env.NODE_ENV ?? "development") as NodeEnv;

dotenv.config({ path: envFileMap[nodeEnv] });

import { migrate } from "drizzle-orm/node-postgres/migrator";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

async function runMigrations() {
  logger.info("Starting database migration...");
  try {
    await migrate(db, {
      migrationsFolder: "./src/db/drizzle",
      migrationsTable: "__drizzle_migration",
      migrationsSchema: "public",
    });
    logger.info("Migrations successfully applied!");
    process.exit(0);
  } catch (error) {
    logger.error("Migration failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

runMigrations();
