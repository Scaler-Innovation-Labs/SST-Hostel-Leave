/**
 * Guardrail preventing accidental destructive operations against remote databases.
 */
export function assertSafeDatabaseTarget(dbUrl?: string): void {
  const url = dbUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const isLocal =
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.includes("host.docker.internal");

  if (!isLocal && process.env.ALLOW_DESTRUCTIVE_REMOTE !== "true") {
    let host = "unknown";
    try {
      host = new URL(url).host;
    } catch {
      // ignore
    }
    console.error("\n=======================================================");
    console.error("⛔ DESTRUCTIVE ACTION REFUSED: Target database is NOT localhost!");
    console.error(`Target Host: ${host}`);
    console.error("To explicitly permit this on a non-production remote database, run:");
    console.error("  ALLOW_DESTRUCTIVE_REMOTE=true npx tsx <script>");
    console.error("=======================================================\n");
    process.exit(1);
  }
}
