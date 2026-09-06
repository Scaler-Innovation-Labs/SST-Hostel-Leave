import QRCode from "qrcode";

import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import { NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { decryptQrToken } from "@/lib/qr-token-crypto";

export type QrImageResult = {
  png: Buffer;
  contentType: "image/png";
  cacheControl: string;
};

/**
 * Renders the QR pass PNG for a given pass. Used as the `src` of the QR
 * <img> in approval emails — a hosted URL renders in Gmail, whereas the
 * previous `data:` URI was stripped by Gmail (users saw only the alt text).
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
 *   pass token, which stays server-side (the leave-event handler fetches
 *   it from the DB at render time).
 * - This is deliberately public: email clients fetch images without
 *   session cookies. Exposure is equivalent to the old data-URI approach
 *   (anyone holding the email holds the QR); scan-time validation still
 *   enforces the pass validity window and status.
 */
export async function getQrImage(qrPassId: string): Promise<QrImageResult> {
  const pass = await qrPassRepository.findById(qrPassId);

  if (!pass) {
    throw new NotFoundError("QR pass not found");
  }

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