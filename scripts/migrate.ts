import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

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
