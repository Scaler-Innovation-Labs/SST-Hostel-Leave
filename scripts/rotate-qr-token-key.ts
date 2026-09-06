import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

/**
 * Roll QR token envelopes forward to the active encryption key.
 *
 * Rotation procedure (see .env.example):
 *   1. Set QR_TOKEN_ENC_KEY_<NEWID> to the new 64-hex key.
 *   2. Point QR_TOKEN_ENC_ACTIVE_KEY_ID at <NEWID>.
 *   3. Run this script: every tokenEnc whose key id differs from the
 *      active id is decrypted with its historic key and re-encrypted
 *      under the active key. Legacy 3-part envelopes (no key id) are
 *      treated as active-key rows and re-stamped with the id.
 *   4. Only then may the old QR_TOKEN_ENC_KEY_<OLDID> be retired.
 *
 * Until this runs, old rows stay readable via historic keys — rotation
 * without re-encryption is "add key, never remove old." Each row update
 * is guarded so a concurrent writer can never clobber a newer envelope,
 * and the script is idempotent: re-running finds nothing to do.
 */
const BATCH_SIZE = 200;

function keyIdOf(envelope: string): string | null | undefined {
  const parts = envelope.split(":");
  if (parts.length === 4 && parts[0] === "v1") return parts[1]!;
  // Legacy 3-part envelopes carry no key id (treated as stale: re-stamp).
  if (parts.length === 3 && parts[0] === "v1") return null;
  return undefined;
}

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");
  const { decryptQrToken, encryptQrToken } = await import("@/lib/qr-token-crypto");
  const activeKeyId =
    process.env.QR_TOKEN_ENC_ACTIVE_KEY_ID?.trim() || "k1";

  console.log(
    `Rolling qr_passes.token_enc forward to active key id "${activeKeyId}"...`
  );

  let rolled = 0;
  let skipped = 0;
  let lastId = "00000000-0000-0000-0000-000000000000";

  // Keyset pagination (id > lastId): each row is visited exactly once per
  // run, so current rows can never pin the loop. Idempotent — re-running
  // finds nothing stale.
  while (true) {
    const rows = await db.execute(sql`
      SELECT id, token_enc FROM qr_passes
      WHERE token_enc IS NOT NULL AND id > ${lastId}
      ORDER BY id
      LIMIT ${BATCH_SIZE};
    `);

    if (rows.rows.length === 0) break;

    for (const row of rows.rows as Array<{ id: string; token_enc: string }>) {
      lastId = row.id;

      const currentKeyId = keyIdOf(row.token_enc);
      if (currentKeyId === undefined) {
        console.log(`  ! skipping ${row.id}: unrecognized envelope format`);
        skipped++;
        continue;
      }
      if (currentKeyId === activeKeyId) continue;

      const rawToken = await decryptQrToken(row.token_enc);
      const fresh = await encryptQrToken(rawToken);

      // Guarded: only replace the exact envelope we read. A concurrent
      // regeneration (new token, new envelope) fails the match and keeps
      // its newer value.
      const updated = await db.execute(sql`
        UPDATE qr_passes SET token_enc = ${fresh}
        WHERE id = ${row.id} AND token_enc = ${row.token_enc};
      `);

      if ((updated.rowCount ?? 0) > 0) {
        rolled++;
      }
    }

    if (rows.rows.length < BATCH_SIZE) break;
  }

  console.log(`  - envelopes rolled forward: ${rolled} (skipped: ${skipped})`);
  console.log("  Done. Verify QR image rendering, then retire the old key.");
}

main().catch((error) => {
  console.error("QR key rotation failed:", error);
  process.exit(1);
});
