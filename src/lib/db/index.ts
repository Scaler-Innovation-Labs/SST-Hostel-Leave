import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import * as schema from "@/db";
import { ConfigurationError } from "@/lib/errors";

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as typeof globalThis & {
	pool?: Pool;
	db?: DbClient;
};

function getOrCreatePool(): Pool {
	if (!globalForDb.pool) {
		const databaseUrl = process.env.DATABASE_URL;
		if (!databaseUrl) {
			throw new ConfigurationError("DATABASE_URL is not set");
		}
		globalForDb.pool = new Pool({ connectionString: databaseUrl });
		globalForDb.pool.on("error", (err: unknown) => {
			console.error("[db] Pool error:", err instanceof Error ? err.message : String(err));
		});
	}
	return globalForDb.pool;
}

function getOrCreateDb(): DbClient {
	if (!globalForDb.db) {
		globalForDb.db = drizzle(getOrCreatePool(), { schema });
	}
	return globalForDb.db;
}

const db = new Proxy({} as DbClient, {
	get(_, prop) {
		const target = getOrCreateDb();
		const value = Reflect.get(target, prop);
		return typeof value === "function" ? value.bind(target) : value;
	},
});

export { db };
export type Database = DbClient;
