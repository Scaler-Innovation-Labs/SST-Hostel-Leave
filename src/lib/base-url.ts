/**
 * Public base URL used when building links embedded in notifications
 * (parent approval links, POC/admin review links, QR links).
 *
 * Prefers NEXT_PUBLIC_BASE_URL when set; otherwise falls back to the
 * production domain so links are never localhost in deployed builds.
 */
const PRODUCTION_BASE_URL = "https://leave.sst-dashboard.com";

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

export function getPublicBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();

  // Local development deliberately supports the value in .env.example. A
  // deployed worker must never emit localhost links, even if that development
  // value was accidentally promoted with the rest of its environment.
  if (process.env.NODE_ENV === "development") {
    return (configuredUrl ?? "http://localhost:3000").replace(/\/+$/, "");
  }

  if (configuredUrl && !isLocalUrl(configuredUrl)) {
    return configuredUrl.replace(/\/+$/, "");
  }

  return PRODUCTION_BASE_URL;
}
