import QRCode from "qrcode";

import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import { NotFoundError } from "@/lib/errors";

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

  if (!pass?.token) {
    throw new NotFoundError("QR pass not found");
  }

  const png = await QRCode.toBuffer(pass.token, {
    width: 200,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return {
    png,
    contentType: "image/png",
    // A pass QR never changes once generated — safe to cache for a year.
    cacheControl: "public, max-age=31536000, immutable",
  };
}