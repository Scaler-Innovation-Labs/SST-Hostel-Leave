import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const BATCH_SIZE = 200;

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");
  const { encryptQrToken } = await import("@/lib/qr-token-crypto");

  console.log("Applying migration 0027 (QR token encryption at rest)...");
  console.log(
    "  Covers: qr_passes.token_enc add, plaintext token backfill (AES-256-GCM), " +
    "verify, qr_passes.token drop"
  );

  // ------------------------------------------------------------------
  // 0. Inspect current columns. Older databases may predate migrate-0010
  //    (no `token` column at all) — there is nothing to backfill there.
  // ------------------------------------------------------------------
  const columns = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'qr_passes' AND column_name IN ('token', 'token_enc');
  `);
  const names = new Set(columns.rows.map((r: any) => r.column_name as string));
  const hasToken = names.has("token");
  const hasTokenEnc = names.has("token_enc");

  // ------------------------------------------------------------------
  // 1. Add the encrypted-envelope column (idempotent).
  // ------------------------------------------------------------------
  if (!hasTokenEnc) {
    await db.execute(sql`
      ALTER TABLE qr_passes
      ADD COLUMN token_enc text;
    `);
    console.log("  - added qr_passes.token_enc");
  } else {
    console.log("  - qr_passes.token_enc already exists (skipping add)");
  }

  // ------------------------------------------------------------------
  // 2. Backfill: encrypt every remaining plaintext token.
  //    Runs in batches; each row is guarded with `token_enc IS NULL` so a
  //    re-run (or a concurrent writer) can never double-encrypt or clobber.
  // ------------------------------------------------------------------
  if (!hasToken) {
    console.log("  - qr_passes.token absent (predates migrate-0010 or already dropped): nothing to backfill");
  } else {
    const pending = await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM qr_passes
      WHERE token IS NOT NULL AND token <> '' AND token_enc IS NULL;
    `);
    const pendingCount = Number((pending.rows[0] as any)?.count ?? 0);
    console.log(`  - rows needing backfill: ${pendingCount}`);

    let done = 0;
    while (true) {
      const batch = await db.execute(sql`
        SELECT id, token FROM qr_passes
        WHERE token IS NOT NULL AND token <> '' AND token_enc IS NULL
        LIMIT ${BATCH_SIZE};
      `);
      if (batch.rows.length === 0) break;

      // Fails loudly when QR_TOKEN_ENC_KEY is missing/malformed — by design:
      // never write a half-migrated state silently.
      for (const row of batch.rows as Array<{ id: string; token: string }>) {
        const envelope = await encryptQrToken(row.token);
        await db.execute(sql`
          UPDATE qr_passes SET token_enc = ${envelope}
          WHERE id = ${row.id} AND token_enc IS NULL;
        `);
        done++;
      }
      console.log(`  - backfilled ${done}/${pendingCount}...`);
    }
  }

  // ------------------------------------------------------------------
  // 3. Verify: NO plaintext-only row may remain before the drop.
  //    This is the hard invariant — the drop below runs only on zero.
  // ------------------------------------------------------------------
  if (hasToken) {
    const remaining = await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM qr_passes
      WHERE token IS NOT NULL AND token <> '' AND token_enc IS NULL;
    `);
    const remainingCount = Number((remaining.rows[0] as any)?.count ?? 0);
    if (remainingCount > 0) {
      throw new Error(
        `VERIFY FAILED: ${remainingCount} row(s) still lack token_enc. ` +
        `Fix the failures above and re-run (the script is idempotent). ` +
        `qr_passes.token was NOT dropped.`
      );
    }
    console.log("  - verify clean: every plaintext token has an encrypted envelope");
  }

  // ------------------------------------------------------------------
  // 4. Drop the plaintext column. Point of no return for the old shape —
  //    code fallbacks are removed in the matching code change.
  // ------------------------------------------------------------------
  if (hasToken) {
    await db.execute(sql`
      ALTER TABLE qr_passes
      DROP COLUMN token;
    `);
    console.log("  - dropped qr_passes.token");
  }

  console.log("Migration 0027 complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    process.exit(0);
  });
