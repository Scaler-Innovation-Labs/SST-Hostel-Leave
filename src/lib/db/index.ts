import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import * as schema from "@/db";
import { ConfigurationError } from "@/lib/errors";

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new ConfigurationError("DATABASE_URL is not set");
}

const globalForDb = globalThis as typeof globalThis & {
	pool?: Pool;
	db?: DbClient;
};

const pool =
	globalForDb.pool ??
	new Pool({
		connectionString: databaseUrl,
	});

const db =
	globalForDb.db ??
	drizzle(pool, {
		schema,
	});

if (process.env.NODE_ENV !== "production") {
	globalForDb.pool = pool;
	globalForDb.db = db;
}

export { db };
export type Database = DbClient;
