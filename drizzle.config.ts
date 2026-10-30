import * as dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

type NodeEnv =
  | "development"
  | "staging"
  | "production";

const envFileMap: Record<NodeEnv, string> = {
  development: ".env.local",
  staging: ".env.staging",
  production: ".env.production",
};

const nodeEnv =
  (process.env.NODE_ENV ??
    "development") as NodeEnv;

dotenv.config({
  path: envFileMap[nodeEnv],
});

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set"
  );
}

function getDbCredentials() {
  const raw = process.env.DATABASE_URL!;
  try {
    const parsed = new URL(raw);
    const sslRequired = parsed.searchParams.get("sslmode") === "require";
    parsed.searchParams.delete("sslmode");
    parsed.searchParams.delete("channel_binding");
    return {
      url: parsed.toString(),
      ssl: sslRequired ? { rejectUnauthorized: false } : undefined,
    };
  } catch {
    return {
      url: raw,
    };
  }
}

export default defineConfig({
  schema: "./src/db/index.ts",

  out: "./src/db/drizzle",

  dialect: "postgresql",

  dbCredentials: getDbCredentials(),

  migrations: {
    table: "__drizzle_migration",
    schema: "public",
  },

  verbose: true,
  strict: true,
});
