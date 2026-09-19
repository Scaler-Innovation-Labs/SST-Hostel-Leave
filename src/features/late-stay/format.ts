import { maskIncludesDay } from "@/constants/leave/late-stay-authorization";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Mask 0b0111110 → "Mon–Fri" style compact label. */
export function formatDaysOfWeek(mask: number): string {
	const days = DAY_LABELS.filter((_, index) => maskIncludesDay(mask, index));
	if (days.length === 0) return "No days";

	const compact = days.join(", ");
	// Collapse contiguous weekday runs: Mon, Tue, Wed, Thu, Fri → Mon–Fri.
	if (
		days.length >= 3 &&
		days.every((_, i) => {
			if (i === 0) return true;
			const prev = DAY_LABELS.indexOf(days[i - 1]!);
			const curr = DAY_LABELS.indexOf(days[i]!);
			return curr === (prev + 1) % 7;
		})
	) {
		return `${days[0]}–${days[days.length - 1]}`;
	}
	return compact;
}

/** 1080 → "18:00". */
export function formatMinutesOfDay(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
