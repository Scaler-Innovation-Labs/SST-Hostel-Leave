/**
 * Resolves which navigation entry owns the current pathname.
 *
 * A parent route owns its children (`/student/leaves` for
 * `/student/leaves/123`), but the *most specific* match wins — otherwise
 * `/student/leaves/new` would highlight both "My leaves" and "Request leave".
 *
 * External destinations (mailto:, http:, https:) never own a route.
 */
export function resolveActiveHref(
  pathname: string,
  hrefs: readonly string[]
): string | null {
  let active: string | null = null;

  for (const href of hrefs) {
    if (
      href.startsWith("mailto:") ||
      href.startsWith("http://") ||
      href.startsWith("https://")
    ) {
      continue;
    }

    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (!matches) continue;

    if (active === null || href.length > active.length) {
      active = href;
    }
  }

  return active;
}
