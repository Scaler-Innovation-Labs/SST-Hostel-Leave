import QRCode from "qrcode";

import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import type { CurrentUser } from "@/lib/auth/types";
import { NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { decryptQrToken } from "@/lib/qr-token-crypto";
import { verifyStudentOwnership } from "@/services/shared/authorization.service";

export type QrImageResult = {
  png: Buffer;
  contentType: "image/png";
  cacheControl: string;
};

/**
 * Renders the QR pass PNG for a given pass. The QR lives only behind the
 * authenticated app (student dashboard / leave detail) — it is never sent
 * by email, so this endpoint requires a session and owner-or-staff
 * authorization.
 *
 * Credential handling:
 * - The raw token is decrypted from `tokenEnc` in memory ONLY for this
 *   render. It is never logged, never persisted, and never leaves this
 *   function except inside the generated PNG pixels.
 * - Decrypt/key failures FAIL LOUDLY (500 + error log with the pass id
 *   only): a silently broken QR image would strand students at the gate.
 *
 * Security notes:
 * - The URL carries only the unguessable qrPassId UUID — never the raw
 *   pass token, which stays server-side.
 * - Callers must own the pass (the student it was issued to) or hold a
 *   staff role; email clients and other unauthenticated fetchers get 401.
 *   Scan-time validation still enforces the pass validity window and
 *   status independently of this render path.
 */
export async function getQrImage(
  qrPassId: string,
  currentUser: CurrentUser
): Promise<QrImageResult> {
  const pass = await qrPassRepository.findById(qrPassId);

  if (!pass) {
    throw new NotFoundError("QR pass not found");
  }

  await verifyStudentOwnership(currentUser, pass.studentId);

  // The ONLY place the encrypted credential is decrypted: in memory, for
  // this single render. A pass without an envelope cannot render.
  let rawToken: string | null = null;
  if (pass.tokenEnc) {
    try {
      rawToken = await decryptQrToken(pass.tokenEnc);
    } catch (error) {
      logger.error("QR image render failed: pass credential undecryptable", {
        qrPassId: pass.id,
      });
      throw error;
    }
  }

  if (!rawToken) {
    throw new NotFoundError("QR pass not found");
  }

  const png = await QRCode.toBuffer(rawToken, {
    width: 200,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return {
    png,
    contentType: "image/png",
    // Bearer credential: shared caches (CDN, corporate proxy, mail image
    // proxy) must never store it, and revocation (invalidate route) must
    // take effect promptly. Short private cache; the email <img> and the
    // dashboard revalidate per view.
    cacheControl: "private, max-age=3600, must-revalidate",
  };
}