type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

/**
 * Shared API fetcher (SWR-compatible).
 *
 * Resolves the envelope's `data` payload on success and throws on failure.
 * Callers must NOT fall back to the raw envelope (`r.data ?? r`) — that
 * pattern silently swallowed server errors and crashed pages (e.g.
 * super-admin/academic-groups) with undefined data.
 */
export async function fetcher<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, options);
  const body = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || body.success === false) {
    throw new Error(
      body.error?.message ?? `Request failed (${response.status})`
    );
  }

  return (body.data ?? body) as T;
}
