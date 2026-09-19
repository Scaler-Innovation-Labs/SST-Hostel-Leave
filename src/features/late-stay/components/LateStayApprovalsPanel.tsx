"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { Button, SectionCard, Skeleton } from "@/design-system/sst";
import { formatDaysOfWeek, formatMinutesOfDay } from "@/features/late-stay/format";
import { fetcher } from "@/lib/api/fetcher";
import {
	decideLateStayAuthorization,
	getLateStayAuthorizationsUrl,
	type LateStayAuthorizationListItem,
	revokeLateStayAuthorization,
} from "@/lib/api/late-stay-api";

const PENDING_STATUSES = new Set(["PENDING_POC", "PENDING_ADMIN"]);
const ACTIVE_STATUS = new Set(["ACTIVE"]);

export function LateStayApprovalsPanel() {
	const [acting, setActing] = useState<string | null>(null);
	const listKey = getLateStayAuthorizationsUrl({ limit: 50 });
	const { data, error, isLoading, mutate } = useSWR<{
		items: LateStayAuthorizationListItem[];
	}>(listKey, fetcher);

	const rows: LateStayAuthorizationListItem[] = data?.items ?? [];

	const decide = async (
		id: string,
		action: "APPROVED" | "REJECTED"
	) => {
		setActing(id);
		try {
			await decideLateStayAuthorization(id, action);
			toast.success(
				action === "APPROVED" ? "Decision recorded" : "Authorization rejected"
			);
			await mutate();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Action failed");
		} finally {
			setActing(null);
		}
	};

	const revoke = async (id: string) => {
		const reason = window.prompt("Revocation reason (required):");
		if (!reason || reason.trim().length < 3) {
			toast.error("A revocation reason is required");
			return;
		}
		setActing(id);
		try {
			await revokeLateStayAuthorization(id, reason.trim());
			toast.success("Authorization revoked — future claims are blocked");
			await mutate();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Revoke failed");
		} finally {
			setActing(null);
		}
	};

	if (error) {
		return (
			<SectionCard Icon={ShieldCheck} title="Late-stay authorizations">
				<p className="text-body text-danger">
					Failed to load authorizations.{" "}
					<button
						type="button"
						className="underline"
						onClick={() => void mutate()}
					>
						Retry
					</button>
				</p>
			</SectionCard>
		);
	}

	return (
		<SectionCard
			Icon={ShieldCheck}
			title="Late-stay authorizations"
			meta="approve once — students claim nightly"
		>
			{isLoading ? (
				<Skeleton className="h-24 w-full" />
			) : rows.length === 0 ? (
				<p className="text-body text-muted">No authorization requests.</p>
			) : (
				<ul className="divide-y divide-border">
					{rows.map((row) => {
						const auth = row.authorization;
						const pending = PENDING_STATUSES.has(auth.status);
						const isActive = ACTIVE_STATUS.has(auth.status);
						return (
							<li key={auth.id} className="py-3">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div className="min-w-0">													<p className="text-body font-medium text-ink">
													{row.studentUser?.fullName ?? "Student"} ·{" "}
													{row.student?.rollNumber ?? "—"}
												</p>
												<p className="text-caption text-muted">
											{auth.validFrom.slice(0, 10)} →{" "}
											{auth.validUntil.slice(0, 10)} · v{auth.version} ·{" "}
											{formatDaysOfWeek(auth.daysOfWeekMask)} ·{" "}
											{formatMinutesOfDay(auth.startTimeMinutes)}–
											{formatMinutesOfDay(auth.endTimeMinutes)} ·{" "}
											{auth.status.replaceAll("_", " ")}
										</p>											<p className="mt-1 text-caption text-muted">{auth.reason}</p>
									</div>
									<div className="flex gap-2">
										{pending && (
											<>
												<Button
													size="sm"
													onClick={() => void decide(auth.id, "APPROVED")}
													loading={acting === auth.id}
													disabled={acting !== null && acting !== auth.id}
												>
													Approve
												</Button>
												<Button
													size="sm"
													variant="outline"
													onClick={() => void decide(auth.id, "REJECTED")}
													loading={acting === auth.id}
													disabled={acting !== null && acting !== auth.id}
												>
													Reject
												</Button>
											</>
										)}
										{isActive && (
											<Button
												size="sm"
												variant="outline"
												onClick={() => void revoke(auth.id)}
												loading={acting === auth.id}
												disabled={acting !== null && acting !== auth.id}
											>
												Revoke
											</Button>
										)}
									</div>
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</SectionCard>
	);
}
