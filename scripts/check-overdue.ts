import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { hostels } = await import("@/db");
  const { qrPassRepository } = await import("@/db/repositories/movement/qr-pass.repository");

  const hostelRows = await db.select({ id: hostels.id, code: hostels.code }).from(hostels);
  const uni1 = hostelRows.find((h) => h.code === "UNI-1")?.id;

  const all = await qrPassRepository.findOverdueReturns({ limit: 200 });
  const uni1Only = await qrPassRepository.findOverdueReturns({ hostelIds: uni1 ? [uni1] : [], limit: 200 });

  console.log(`Overdue returns (SUPER-ADMIN all): ${all.length}`);
  console.log(`Overdue returns (ADMIN UNI-1):     ${uni1Only.length}`);
  for (const r of all.slice(0, 8)) {
    console.log(`  ${r.studentName ?? "?"} | ${r.leaveTypeName ?? "?"} | end ${r.leaveEndAt?.toISOString() ?? "?"} | exit ${r.firstScanAt?.toISOString() ?? "?"} | closed ${r.closedAt ?? "null"} | hostel ${r.hostelName ?? "?"}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
