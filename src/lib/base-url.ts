/**
 * Public base URL used when building links embedded in notifications
 * (parent approval links, POC/admin review links, QR links).
 *
 * Prefers NEXT_PUBLIC_BASE_URL when set; otherwise falls back to the
 * production domain so links are never localhost in deployed builds.
 */
const PRODUCTION_BASE_URL = "https://leave.sst-dashboard.com";
const LOCAL_DEV_BASE_URL = "http://localhost:3000";

function isLocalUrl(value: string): boolean {
  try {
    const { hostname } = new URL(value);
    return (
      hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
    );
  } catch {
    return false;
  }
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getPublicBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || undefined;

  // A public configured URL always wins, including in local development.
  if (configuredUrl && !isLocalUrl(configuredUrl)) {
    return normalizeBaseUrl(configuredUrl);
  }

  // Localhost links are opt-in. NODE_ENV alone is not proof of a developer
  // machine: a worker host can inherit or be started with NODE_ENV=development
  // while holding a localhost NEXT_PUBLIC_BASE_URL. Without the explicit flag
  // such a process still emits public links. Local dev sets the flag in
  // .env.local so approval and QR links open the local app.
  const localhostAllowed =
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_LOCALHOST_LINKS === "true";

  if (localhostAllowed) {
    return normalizeBaseUrl(configuredUrl ?? LOCAL_DEV_BASE_URL);
  }

  return PRODUCTION_BASE_URL;
}
