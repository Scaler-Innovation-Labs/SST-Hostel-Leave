import { ConfigurationError, ValidationError } from "@/lib/errors";

/**
 * Authenticated encryption for QR pass bearer tokens at rest.
 *
 * The raw QR token is a bearer credential: anyone holding it can check a
 * student out/in at the gate. It must never be persisted in plaintext, so
 * new passes store only:
 *   - `tokenHash` (SHA-256) — gate-scan authentication (hash-only lookup)
 *   - `tokenEnc` (this module) — QR image reconstruction on demand
 *
 * Threat model: a database leak alone must NOT expose the bearer token.
 * `tokenHash` is a one-way hash (not sufficient to scan without the
 * preimage); `tokenEnc` is recoverable only with the key below. The key
 * lives OUTSIDE the database, is never logged, and never enters
 * outbox/audit payloads.
 *
 * Envelope format (current): `v1:<keyId>:<base64url iv>:<base64url ciphertext+tag>`.
 * Legacy rows written as `v1:<iv>:<ciphertext+tag>` (3 parts, no key id)
 * are still accepted and resolve to the active key.
 * The key-id segment exists so keys can be rotated (v2, ...) without
 * redesigning the database: decrypt picks the key by id, encrypt stamps
 * the active id.
 *
 * Key resolution:
 *   - active id = `QR_TOKEN_ENC_ACTIVE_KEY_ID` (default `k1`), `[A-Za-z0-9_-]{1,16}`
 *   - active key = `QR_TOKEN_ENC_KEY` (64 hex chars = 32 bytes AES-256-GCM)
 *   - historic keys = `QR_TOKEN_ENC_KEY_<KEYID>` (same format), e.g.
 *     `QR_TOKEN_ENC_KEY_K1`, `QR_TOKEN_ENC_KEY_K2`
 *
 * The key is deliberately NOT cached across calls: every operation re-reads
 * the environment so a rotation (process restart with new values) cannot
 * serve stale key material, and tests can stub variables per case.
 *
 * Error messages here must NEVER include the token, the envelope, or the
 * key — callers log only the pass id.
 */

const ENVELOPE_VERSION = "v1";
const KEY_ENV_VAR = "QR_TOKEN_ENC_KEY";
const ACTIVE_KEY_ID_ENV_VAR = "QR_TOKEN_ENC_ACTIVE_KEY_ID";
const DEFAULT_KEY_ID = "k1";
const IV_LENGTH_BYTES = 12;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function importKey(keyId?: string): Promise<CryptoKey> {
  const resolvedKeyId = keyId ?? getActiveKeyId();
  const raw = readKeyMaterial(resolvedKeyId)?.trim();

  if (!raw) {
    throw new ConfigurationError(
      `QR token encryption key is not configured for key id "${resolvedKeyId}". Set ${KEY_ENV_VAR} (active key) or ${KEY_ENV_VAR}_${resolvedKeyId.toUpperCase()} (historic key) to 32 random bytes as 64 hex characters (generate with: openssl rand -hex 32).`
    );
  }

  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new ConfigurationError(
      `QR token encryption key has an invalid format. Expected 64 hex characters (32 bytes for AES-256-GCM).`
    );
  }

  return crypto.subtle.importKey("raw", hexToBytes(raw), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

function getActiveKeyId(): string {
  const raw = process.env[ACTIVE_KEY_ID_ENV_VAR]?.trim() || DEFAULT_KEY_ID;
  if (!/^[A-Za-z0-9_-]{1,16}$/.test(raw)) {
    throw new ConfigurationError(
      `QR token encryption key id has an invalid format. ${ACTIVE_KEY_ID_ENV_VAR} must match [A-Za-z0-9_-]{1,16}.`
    );
  }
  return raw;
}

function readKeyMaterial(keyId: string): string | undefined {
  const activeKeyId = getActiveKeyId();
  if (keyId === activeKeyId) {
    return process.env[KEY_ENV_VAR];
  }
  const suffix = keyId.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!suffix) return undefined;
  return process.env[`${KEY_ENV_VAR}_${suffix}`];
}

export async function encryptQrToken(token: string): Promise<string> {
  if (!token) {
    throw new ValidationError("Cannot encrypt an empty QR token.");
  }

  const keyId = getActiveKeyId();
  const key = await importKey(keyId);
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(IV_LENGTH_BYTES)));
  const encoded = new TextEncoder().encode(token);
  const data = new Uint8Array(new ArrayBuffer(encoded.length));
  data.set(encoded);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data)
  );

  return `${ENVELOPE_VERSION}:${keyId}:${bytesToBase64Url(iv)}:${bytesToBase64Url(ciphertext)}`;
}

export async function decryptQrToken(envelope: string): Promise<string> {
  if (!envelope) {
    throw new ValidationError("Cannot decrypt an empty QR credential.");
  }

  const parts = envelope.split(":");
  // Legacy rows: v1:<iv>:<ct> (no key id) → active key.
  // Current rows: v1:<keyId>:<iv>:<ct> → key selected by id for rotation.
  let keyId: string;
  let ivPart: string;
  let ctPart: string;
  if (parts.length === 3 && parts[0] === ENVELOPE_VERSION) {
    keyId = getActiveKeyId();
    ivPart = parts[1]!;
    ctPart = parts[2]!;
  } else if (
    parts.length === 4 &&
    parts[0] === ENVELOPE_VERSION &&
    /^[A-Za-z0-9_-]{1,16}$/.test(parts[1]!)
  ) {
    keyId = parts[1]!;
    ivPart = parts[2]!;
    ctPart = parts[3]!;
  } else {
    throw new ConfigurationError(
      "QR pass credential has an unsupported format and cannot be decrypted."
    );
  }

  const key = await importKey(keyId);

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlToBytes(ivPart) },
      key,
      base64UrlToBytes(ctPart)
    );
  } catch {
    // AES-GCM authentication failure: wrong key, tampered envelope, or
    // truncated value. Indistinguishable by design — and the message must
    // not echo any credential material.
    throw new ConfigurationError(
      "QR pass credential could not be decrypted. The encryption key may be incorrect or the stored value may have been tampered with."
    );
  }

  return new TextDecoder().decode(plaintext);
}
