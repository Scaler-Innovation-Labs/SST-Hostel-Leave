import * as dotenv from "dotenv";
// drizzle-kit is optional in this environment; export a plain config object

type NodeEnv = "production" | "development" | "staging";

// Load environment variables first
const envFileMap: Record<NodeEnv, string> = {
  development: ".env.local",
  staging: ".env.staging",
  production: ".env.production",
};

// Default to development if NODE_ENV is not set
const nodeEnv = (process.env.NODE_ENV || "development") as NodeEnv;

// Load the correct env file
dotenv.config({ path: envFileMap[nodeEnv] });

console.debug(`Using environment: ${nodeEnv}`);
console.debug(`Database URL: ${process.env.DATABASE_URL}`);
console.debug(process.env.URL);

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

const dbURL = process.env.URL || process.env.DATABASE_URL;
const config = ({
  out: "./src/db/drizzle", // migrations folder
  schema: "./src/db/schema.ts", // your Drizzle schema file
  dialect: "postgresql",
  dbCredentials: {
    url: dbURL!,
  },
  migrations: {
    table: "__drizzle_migration",
    schema: "public",
  },
  verbose: true,
  strict: true,
});

export default config;