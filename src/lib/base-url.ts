/**
 * Public base URL used when building links embedded in notifications
 * (parent approval links, POC/admin review links, QR links).
 *
 * Prefers NEXT_PUBLIC_BASE_URL when set; otherwise falls back to the
 * production domain so links are never localhost in deployed builds.
 */
export function getPublicBaseUrl(): string {
	return (
		process.env.NEXT_PUBLIC_BASE_URL ??
		"https://sst-hostel-leave.vercel.app"
	).replace(/\/+$/, "");
}
