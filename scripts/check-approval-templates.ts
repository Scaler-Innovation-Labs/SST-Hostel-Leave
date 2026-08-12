import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  console.log("Connecting to DB...");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Scanning ALL templates for leftover view-link copy...");

  const detail = await db.execute(sql`
    SELECT code, template_body
    FROM notification_templates
    WHERE code = 'leave_approved_email_long_leave'
  `);
  const detailData = Array.isArray(detail) ? detail : (detail as { rows?: unknown }).rows ?? [];
  console.log("\nLIVE BODY (leave_approved_email_long_leave):");
  console.log(JSON.stringify(detailData, null, 2));
  const rows = await db.execute(sql`
    SELECT
      code,
      event_key,
      channel,
      (template_body LIKE '%View your QR Pass%') AS has_link_copy,
      (template_body LIKE '%Scan this QR code at the hostel gate%') AS has_current_copy,
      (template_body LIKE '%{{qrCodeUrl}}%') AS has_qr_var,
      (template_body LIKE '%qrserver%') AS has_qrserver,
      updated_at
    FROM notification_templates
    ORDER BY event_key, channel, code
  `);

  const data = Array.isArray(rows) ? rows : (rows as { rows?: unknown }).rows ?? [];
  const list = data as Array<Record<string, unknown>>;

  const leftovers = list.filter(
    (r) => r.has_link_copy === true || r.has_qrserver === true,
  );
  const qrMissing = list.filter(
    (r) =>
      r.event_key === "LEAVE_APPROVED" &&
      r.channel === "EMAIL" &&
      r.has_qr_var === false,
  );
  const staleCopy = list.filter(
    (r) =>
      r.event_key === "LEAVE_APPROVED" &&
      r.channel === "EMAIL" &&
      r.has_current_copy === false,
  );

  console.log(`\nTotal templates: ${list.length}`);
  console.log(`Templates with leftover link copy / qrserver: ${leftovers.length}`);
  console.log(`LEAVE_APPROVED emails WITHOUT {{qrCodeUrl}}: ${qrMissing.length}`);
  console.log(`LEAVE_APPROVED emails NOT on current seed copy: ${staleCopy.length}`);

  if (leftovers.length) {
    console.log("\nLeftovers:");
    console.log(JSON.stringify(leftovers, null, 2));
  }
  if (qrMissing.length) {
    console.log("\nApproval emails missing QR var:");
    console.log(JSON.stringify(qrMissing, null, 2));
  }
  if (staleCopy.length) {
    console.log("\nApproval emails with non-current QR copy:");
    console.log(JSON.stringify(staleCopy, null, 2));
  }

  if (leftovers.length === 0 && qrMissing.length === 0 && staleCopy.length === 0) {
    console.log("\nAll templates are clean — embedded-QR copy is live everywhere.");
  }
  process.exit(0);
}

main().catch((error) => {
  console.error("Check failed:", error);
  process.exit(1);
});
