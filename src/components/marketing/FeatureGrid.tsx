import {
  BarChart3,
  GitBranch,
  Link2,
  QrCode,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Reveal } from "@/components/marketing/Reveal";

const features = [
	{
		icon: Link2,
		title: "Parent Link Approval",
		description:
			"Parents approve leave requests securely through tokenized approval links — no login required.",
	},
	{
		icon: QrCode,
		title: "QR Movement Tracking",
		description:
			"Track hostel movement using secure QR scans and guard verification.",
	},
	{
		icon: Users,
		title: "Role-Based Operations",
		description:
			"Dedicated dashboards for students, POCs, admins, and super admins.",
	},
	{
		icon: GitBranch,
		title: "Workflow Visibility",
		description:
			"Track approvals, escalations, and movement activity in real time.",
	},
	{
		icon: ShieldCheck,
		title: "Policy-Driven Rules",
		description:
			"Restrict leave types dynamically based on institutional policies.",
	},
	{
		icon: BarChart3,
		title: "Operational Analytics",
		description:
			"Gain visibility into approvals, hostel occupancy, and movement trends.",
	},
];

export function FeatureGrid() {
	return (
		<section
			id="features"
			className="py-16 md:py-20"
		>
			<div className="mx-auto max-w-7xl px-8">
				<Reveal>
					<div className="max-w-2xl">
						<h2 className="text-4xl font-bold tracking-tight">
							Built for operational clarity.
						</h2>

						<p className="mt-4 text-lg text-muted-foreground">
							Streamline approvals, movement,
							and communication workflows across
							institutions.
						</p>
					</div>
				</Reveal>

				<div
					className="
						mt-16 grid gap-6
						md:grid-cols-2
						xl:grid-cols-3
					"
				>
					{features.map((feature, index) => (
						<Reveal key={feature.title} delay={(index % 3) * 100}>
							<div
								className="
									group h-full rounded-2xl border border-border
									bg-card p-6 transition-all duration-300
									hover:-translate-y-1 hover:border-primary/40
									hover:bg-accent/40 hover:shadow-[0_12px_40px_-12px_rgba(59,130,246,0.25)]
								"
							>
								<div
									className="
										flex size-11 items-center justify-center
										rounded-xl border border-primary/20 bg-primary/10
										text-primary transition-colors group-hover:bg-primary/20
									"
								>
									<feature.icon className="size-5" />
								</div>

								<h3 className="mt-5 text-lg font-semibold">
									{feature.title}
								</h3>

								<p className="mt-3 text-sm leading-7 text-muted-foreground">
									{feature.description}
								</p>
							</div>
						</Reveal>
					))}
				</div>
			</div>
		</section>
	);
}
