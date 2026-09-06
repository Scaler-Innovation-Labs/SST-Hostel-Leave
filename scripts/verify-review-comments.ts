/**
 * Verifies reviewer-comments wiring for decision emails.
 *
 * Every student-facing LEAVE_APPROVED / LEAVE_REJECTED email template must
 * embed {{reviewCommentsSection}} so approver/rejector comments supplied at
 * decision time reach the email (empty when no comments were left).
 *
 * Usage:
 *   npx tsx scripts/verify-review-comments.ts
 */
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

dotenvConfig({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { notificationTemplates } = await import("@/db");

  const rows = await db.select().from(notificationTemplates);

  const decisionEmails = rows.filter(
    (t) =>
      t.channel === "EMAIL" &&
      (t.eventKey === "LEAVE_APPROVED" || t.eventKey === "LEAVE_REJECTED")
  );

  const missing = decisionEmails.filter(
    (t) => !(t.templateBody ?? "").includes("{{reviewCommentsSection}}")
  );

  console.log(`decision email templates: ${decisionEmails.length}`);
  console.log(
    `with {{reviewCommentsSection}}: ${decisionEmails.length - missing.length}`
  );

  if (missing.length > 0) {
    console.error(
      "MISSING section:",
      missing.map((t) => t.code).join(", ")
    );
    process.exit(1);
  }

  console.log("OK: all decision emails carry the comments section.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
