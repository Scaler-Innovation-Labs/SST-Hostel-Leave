import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Client } from "pg";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("ALTER TABLE notification_templates DROP CONSTRAINT IF EXISTS notification_template_event_channel_unq;");
  console.log("Dropped template event+channel unique constraint.");
  await client.end();
}
main().catch(console.error);
