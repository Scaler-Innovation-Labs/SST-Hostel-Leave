import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

dotenvConfig({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { notificationTemplates } = await import("@/db");
  const rows = await db.select().from(notificationTemplates);
  for (const t of rows) {
    if (t.code.includes("late_stay") || t.code.includes("admin")) {
      console.log(`=== ${t.code} ===`);
      console.log(t.templateBody);
      console.log();
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});