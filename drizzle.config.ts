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

export default defineConfig({
  schema: "./src/db/index.ts",

  out: "./src/db/drizzle",

  dialect: "postgresql",

  dbCredentials: {
    url: process.env.DATABASE_URL,
  },

  migrations: {
    table: "__drizzle_migration",
    schema: "public",
  },

  verbose: true,
  strict: true,
});