import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { seedNotificationTemplates } = await import(
    "@/db/seed/notification-templates.seed"
  );
  const { seedNotificationRules } = await import(
    "@/db/seed/notification-rules.seed"
  );

  console.log("Seeding notification templates...");
  await seedNotificationTemplates();
  console.log("Seeding notification rules...");
  await seedNotificationRules();
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));