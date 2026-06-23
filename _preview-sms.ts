import { eq } from "drizzle-orm";

import { leaveRequests } from "@/db/schema/leave";
import { db } from "@/lib/db";

async function main() {
  const leave = await db.select().from(leaveRequests).where(eq(leaveRequests.id, "44bb3672-ce59-4621-980d-5cd41e376b71")).then(r => r[0]);
  console.log(JSON.stringify(leave, null, 2));
}
main();
