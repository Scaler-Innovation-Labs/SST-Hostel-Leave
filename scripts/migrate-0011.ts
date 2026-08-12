import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { asc, eq } = await import("drizzle-orm");
  const { leaveTypes } = await import("@/db");
  const { LEAVE_TYPE_COLOR_PALETTE } = await import(
    "@/constants/leave/leave-category"
  );

  console.log("Backfilling leave type colors...");

  const rows = await db
    .select({
      id: leaveTypes.id,
      name: leaveTypes.name,
      uiConfig: leaveTypes.uiConfig,
    })
    .from(leaveTypes)
    .orderBy(asc(leaveTypes.name));

  let updated = 0;
  for (const [index, row] of rows.entries()) {
    const uiConfig = (row.uiConfig ?? {}) as Record<string, unknown>;
    if (typeof uiConfig.color === "string") continue;

    await db
      .update(leaveTypes)
      .set({
        uiConfig: {
          ...uiConfig,
          color:
            LEAVE_TYPE_COLOR_PALETTE[index % LEAVE_TYPE_COLOR_PALETTE.length],
        },
      })
      .where(eq(leaveTypes.id, row.id));
    updated += 1;
    console.log(`  - ${row.name} -> color assigned`);
  }

  console.log(`Leave type color backfill complete! (${updated} updated)`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
