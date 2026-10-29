/**
 * Dispatches mailto actions across both mobile and desktop platforms.
 *
 * Context & Behavior:
 * - On mobile devices (iOS/Android), `mailto:` triggers the native mail app (e.g. Gmail/Apple Mail).
 * - On desktop browsers (Chrome, Edge, Firefox), `mailto:` often fails silently because
 *   most users do not have a desktop email client (such as Outlook) registered.
 *   For desktop users, this opens Gmail Web Compose in a new tab with recipient and subject
 *   pre-filled (matching the Google Workspace accounts used by SST students and staff),
 *   while also dispatching the mailto protocol as a background fallback for local clients.
 */
export function openMailto(href: string): void {
  if (typeof window === "undefined") return;

  if (!href.startsWith("mailto:")) {
    window.location.href = href;
    return;
  }

  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  if (isMobile) {
    window.location.href = href;
    return;
  }

  // Parse recipient, subject, and body from mailto: URL for desktop
  const raw = href.slice("mailto:".length);
  const [toPart, queryPart] = raw.split("?");
  const to = decodeURIComponent(toPart || "");
  const params = new URLSearchParams(queryPart || "");
  const subject = params.get("subject") ?? "";
  const body = params.get("body") ?? "";

  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    to
  )}&su=${encodeURIComponent(subject)}${
    body ? `&body=${encodeURIComponent(body)}` : ""
  }`;

  // 1. Dispatch standard mailto protocol for users with configured desktop clients
  try {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = href;
    document.body.appendChild(iframe);
    setTimeout(() => {
      iframe.remove();
    }, 1000);
  } catch {
    // If iframe fails, try direct location
    window.location.href = href;
  }

  // 2. Open Gmail Web Compose in a new tab as the reliable web destination on desktop
  window.open(gmailUrl, "_blank", "noopener,noreferrer");
}
