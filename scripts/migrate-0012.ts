import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const LEAVE_TYPE_COLOR_BY_CODE: Record<string, string> = {
  RE_EXAM: "#4f46e5",
  LONG_LEAVE: "#2563eb",
  LATE_ENTRY: "#0284c7",
  LATE_STAY_COLLEGE: "#0d9488",
  DIFFERENT_HOSTEL: "#7c3aed",
  HOLIDAY: "#ea580c",
  INTERNSHIP: "#c026d3",
  MARRIAGE_BEREAVEMENT: "#78716c",
};

async function main() {
  const { db } = await import("@/lib/db");
  const { eq } = await import("drizzle-orm");
  const { leaveTypes } = await import("@/db");

  console.log("Reassigning leave type colors...");

  const rows = await db
    .select({
      id: leaveTypes.id,
      code: leaveTypes.code,
      name: leaveTypes.name,
    })
    .from(leaveTypes);

  let updated = 0;
  for (const row of rows) {
    const color = LEAVE_TYPE_COLOR_BY_CODE[row.code];
    if (!color) continue;

    await db
      .update(leaveTypes)
      .set({ uiConfig: { color } })
      .where(eq(leaveTypes.id, row.id));
    updated += 1;
    console.log(`  - ${row.name} -> ${color}`);
  }

  console.log(`Leave type color reassignment complete! (${updated} updated)`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));