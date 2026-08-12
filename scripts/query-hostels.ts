import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

dotenvConfig({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { hostels } = await import("@/db");
  const rows = await db.select().from(hostels);
  console.log(
    JSON.stringify(
      rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        slackAdminGroupId: r.slackAdminGroupId,
        isActive: r.isActive,
      })),
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});