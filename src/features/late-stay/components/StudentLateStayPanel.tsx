"use client";

import { CalendarClock, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";

import { LATE_STAY_AUTH_STATUS } from "@/constants/leave/late-stay-authorization";
import {
	Button,
	ErrorState,
	Field,
	SectionCard,
	Skeleton,
} from "@/design-system/sst";
import { formatDaysOfWeek, formatMinutesOfDay } from "@/features/late-stay/format";
import { fetcher } from "@/lib/api/fetcher";
import {
	claimLateStayOccurrence,
	createLateStayAuthorization,
	fetchClaimEligibility,
	getLateStayAuthorizationsUrl,
	type LateStayAuthorizationListItem,
} from "@/lib/api/late-stay-api";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type StatusChipProps = { status: string };

function StatusChip({ status }: StatusChipProps) {
	const styles: Record<string, string> = {
		PENDING_POC: "bg-warning-light text-warning",
		PENDING_ADMIN: "bg-warning-light text-warning",
		ACTIVE: "bg-success-light text-success",
		REJECTED: "bg-danger-light text-danger",
		REVOKED: "bg-danger-light text-danger",
		EXPIRED: "bg-surface-sunken text-muted",
		SUPERSEDED: "bg-surface-sunken text-muted",
	};
	return (
		<span
			className={`inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium ${styles[status] ?? "bg-surface-sunken text-muted"}`}
		>
			{status.replaceAll("_", " ")}
		</span>
	);
}

export function StudentLateStayPanel() {
	const [form, setForm] = useState({
		validFrom: "",
		validUntil: "",
		startTime: "18:00",
		endTime: "22:00",
		days: [1, 2, 3, 4, 5] as number[],
		reason: "",
	});
	const [submitting, setSubmitting] = useState(false);
	const [claiming, setClaiming] = useState(false);

	const listKey = getLateStayAuthorizationsUrl({ limit: 20 });
	const { data, error, isLoading } = useSWR<{
		items: LateStayAuthorizationListItem[];
	}>(listKey, fetcher);
	const eligibility = useSWR("late-stay-claim-eligibility", fetchClaimEligibility);

	const authorizations = (data?.items ?? []).map((row) => row.authorization);
	const active = authorizations.find(
		(auth) => auth.status === LATE_STAY_AUTH_STATUS.ACTIVE
	);

	const toggleDay = (day: number) => {
		setForm((prev) => ({
			...prev,
			days: prev.days.includes(day)
				? prev.days.filter((d) => d !== day)
				: [...prev.days, day].sort((a, b) => a - b),
		}));
	};

	const submitRequest = async () => {
		setSubmitting(true);
		try {
			const leaveTypeId = await resolveLateStayTypeId();
			await createLateStayAuthorization({
				leaveTypeId,
				validFrom: form.validFrom,
				validUntil: form.validUntil,
				startTime: form.startTime,
				endTime: form.endTime,
				daysOfWeek: form.days,
				reason: form.reason,
			});
			toast.success("Authorization request submitted for approval");
			setForm((prev) => ({ ...prev, reason: "" }));
			await mutate(listKey);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Submission failed");
		} finally {
			setSubmitting(false);
		}
	};

	const claimTonight = async () => {
		if (!active) return;
		setClaiming(true);
		try {
			const result = (await claimLateStayOccurrence(active.id)) as {
				idempotentReplay?: boolean;
				requestNumber?: string;
			};
			toast.success(
				result?.idempotentReplay
					? `Already claimed tonight (${result.requestNumber})`
					: `Late stay claimed for tonight (${result?.requestNumber ?? ""}) — the QR is on the leave`
			);
			await mutate(listKey);
			void eligibility.mutate();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Claim failed");
		} finally {
			setClaiming(false);
		}
	};

	if (error) {
		return (
			<ErrorState
				title="Failed to load late-stay authorizations"
				onRetry={() => void mutate(listKey)}
			/>
		);
	}

	return (
		<div className="space-y-4">
			<SectionCard
				Icon={ShieldCheck}
				title="Recurring late stay"
				meta={active ? "ACTIVE" : "NONE"}
			>
				{isLoading ? (
					<Skeleton className="h-16 w-full" />
				) : active ? (
					<div className="space-y-3">
						<div className="flex items-center gap-2">
							<StatusChip status={active.status} />
							<span className="text-body text-muted">
								v{active.version} · {formatDaysOfWeek(active.daysOfWeekMask)} ·{" "}
								{formatMinutesOfDay(active.startTimeMinutes)}–
								{formatMinutesOfDay(active.endTimeMinutes)} · until{" "}
								{active.validUntil.slice(0, 10)}
							</span>
						</div>
						<div className="flex items-center gap-3">
							<Button
								onClick={claimTonight}
								loading={claiming}
								loadingText="Claiming…"
								disabled={!eligibility.data?.eligible}
							>
								{eligibility.data?.alreadyClaimed
									? "Already claimed tonight"
									: "Claim tonight's late stay"}
							</Button>
							<span className="text-caption text-muted">
								A claim creates tonight&apos;s approved late-stay pass — required
								before you stay late.
							</span>
						</div>
					</div>
				) : (
					<p className="text-body text-muted">
						No active recurring authorization. Submit a request below or apply
						for a one-time Late Stay At College leave.
					</p>
				)}
			</SectionCard>

			{!active && (
				<SectionCard
					Icon={Sparkles}
					title="Request recurring authorization"
					meta="POC + warden approval, once"
				>
					<div className="grid gap-4 md:grid-cols-2">
						<Field htmlFor="ls-from" label="Valid from">
							<input
								id="ls-from"
								type="date"
								className="w-full rounded-md border border-border px-3 py-2 text-body"
								value={form.validFrom}
								onChange={(e) =>
									setForm((prev) => ({ ...prev, validFrom: e.target.value }))
								}
							/>
						</Field>
						<Field htmlFor="ls-until" label="Valid until">
							<input
								id="ls-until"
								type="date"
								className="w-full rounded-md border border-border px-3 py-2 text-body"
								value={form.validUntil}
								onChange={(e) =>
									setForm((prev) => ({ ...prev, validUntil: e.target.value }))
								}
							/>
						</Field>
						<Field htmlFor="ls-start" label="Daily window start">
							<input
								id="ls-start"
								type="time"
								className="w-full rounded-md border border-border px-3 py-2 text-body"
								value={form.startTime}
								onChange={(e) =>
									setForm((prev) => ({ ...prev, startTime: e.target.value }))
								}
							/>
						</Field>
						<Field htmlFor="ls-end" label="Daily window end">
							<input
								id="ls-end"
								type="time"
								className="w-full rounded-md border border-border px-3 py-2 text-body"
								value={form.endTime}
								onChange={(e) =>
									setForm((prev) => ({ ...prev, endTime: e.target.value }))
								}
							/>
						</Field>
					</div>
					<div className="mt-4">
						<Field htmlFor="ls-days" label="Days">
							<div id="ls-days" className="flex flex-wrap gap-2">
								{DAY_LABELS.map((label, index) => (
									<button
										key={label}
										type="button"
										onClick={() => toggleDay(index)}
										className={`rounded-full border px-3 py-1 text-caption font-medium transition ${
											form.days.includes(index)
												? "border-accent bg-accent text-on-fill"
												: "border-border text-muted"
										}`}
									>
										{label}
									</button>
								))}
							</div>
						</Field>
					</div>
					<div className="mt-4">
						<Field htmlFor="ls-reason" label="Reason">
							<textarea
								id="ls-reason"
								className="min-h-20 w-full rounded-md border border-border px-3 py-2 text-body"
								value={form.reason}
								maxLength={500}
								onChange={(e) =>
									setForm((prev) => ({ ...prev, reason: e.target.value }))
								}
								placeholder="Why do you need to stay late on these days?"
							/>
						</Field>
					</div>
					<div className="mt-4">
						<Button
							onClick={submitRequest}
							loading={submitting}
							loadingText="Submitting…"
							disabled={
								!form.validFrom ||
								!form.validUntil ||
								form.days.length === 0 ||
								form.reason.trim().length < 10
							}
						>
							Submit for approval
						</Button>
					</div>
				</SectionCard>
			)}

			<SectionCard Icon={CalendarClock} title="My authorizations">
				{isLoading ? (
					<Skeleton className="h-16 w-full" />
				) : authorizations.length === 0 ? (
					<p className="text-body text-muted">No requests yet.</p>
				) : (
					<ul className="divide-y divide-border">
						{authorizations.map((auth) => (
							<li key={auth.id} className="flex items-center justify-between py-3">
								<div>
									<p className="text-body font-medium text-ink">
										{auth.validFrom.slice(0, 10)} → {auth.validUntil.slice(0, 10)}{" "}
										· v{auth.version}
									</p>
									<p className="text-caption text-muted">
										{formatDaysOfWeek(auth.daysOfWeekMask)} ·{" "}
										{formatMinutesOfDay(auth.startTimeMinutes)}–
										{formatMinutesOfDay(auth.endTimeMinutes)}
									</p>
								</div>
								<StatusChip status={auth.status} />
							</li>
						))}
					</ul>
				)}
			</SectionCard>
		</div>
	);
}

async function resolveLateStayTypeId(): Promise<string> {
	const res = await fetch("/api/v1/leave-types");
	const json = await res.json();
	const payload = (json.data ?? {}) as {
		items?: Array<{ id: string; code: string }>;
	};
	const types = payload.items ?? (payload as unknown as Array<{ id: string; code: string }>);
	const lateStay = types.find((type) => type.code === "LATE_STAY_COLLEGE");
	if (!lateStay) {
		throw new Error("LATE_STAY_COLLEGE leave type is not configured");
	}
	return lateStay.id;
}
