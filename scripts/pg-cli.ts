import { execSync } from "node:child_process";

/**
 * Local Postgres service + image — kept in sync with docker-compose.yml.
 * Used as a fallback for the dump/restore scripts when the Postgres client
 * tools are not installed on the host (common on Windows).
 */
export const LOCAL_POSTGRES_SERVICE = "postgres";
export const LOCAL_POSTGRES_IMAGE = "postgres:18";

/** True when a CLI binary is installed and runnable from this shell. */
export function hasCommand(command: string): boolean {
  try {
    execSync(`${command} --version`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
