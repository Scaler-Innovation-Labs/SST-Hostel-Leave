import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db";
import { ConfigurationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as typeof globalThis & {
	pool?: Pool;
	db?: DbClient;
};

function sanitizeConnectionString(raw: string): {
	url: string;
	ssl: boolean;
} {
	const parsed = new URL(raw);
	const ssl = parsed.searchParams.get("sslmode") === "require";
	parsed.searchParams.delete("sslmode");
	parsed.searchParams.delete("channel_binding");
	return { url: parsed.toString(), ssl };
}

function getOrCreatePool(): Pool {
	if (!globalForDb.pool) {
		const databaseUrl = process.env.DATABASE_URL;
		if (!databaseUrl) {
			throw new ConfigurationError("DATABASE_URL is not set");
		}
		// Bounded for serverless bursts (Vercel): a capped pool with
		// timeouts fails fast with a retriable error instead of hanging
		// until the platform kills the invocation.
		//
		// TLS interop: this pg build treats `sslmode=require` in the URL as
		// verify-full, which self-managed RDS/PgBouncer endpoints (self-signed
		// certs) cannot satisfy — the explicit option below would be ignored.
		// So `sslmode`/`channel_binding` (Neon-only) are stripped from the URL
		// and TLS-without-CA-verification is configured explicitly instead.
		const { url, ssl } = sanitizeConnectionString(databaseUrl);
		globalForDb.pool = new Pool({
			connectionString: url,
			max: 10,
			idleTimeoutMillis: 30_000,
			connectionTimeoutMillis: 10_000,
			...(ssl ? { ssl: { rejectUnauthorized: false } } : {}),
		});
		globalForDb.pool.on("error", (err: unknown) => {
			logger.error("[db] Pool error", {
				error: err instanceof Error ? err.message : String(err),
			});
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
