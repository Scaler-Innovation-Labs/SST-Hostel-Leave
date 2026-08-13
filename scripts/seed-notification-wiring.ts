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

  await seedNotificationTemplates();
  await seedNotificationRules();
  console.log("Notification wiring seed complete!");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
