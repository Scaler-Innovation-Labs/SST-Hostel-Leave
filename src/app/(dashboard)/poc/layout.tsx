import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { NAVIGATION } from "@/constants/navigation";
import { ROUTES } from "@/constants/routes";
import { ApprovalCountBadge } from "@/features/approvals/components/ApprovalCountBadge";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { ROLES } from "@/lib/auth/roles";

type POCLayoutProps = {
	children: React.ReactNode;
};

export default async function POCLayout({
	children,
}: POCLayoutProps) {
	const user = await getCurrentUser();

	if (!user) {
		redirect("/unauthorized");
	}

	if (!user.roles.some((r) => r === ROLES.POC)) {
		redirect("/unauthorized");
	}  const shellItems =
    NAVIGATION.poc.map(
      ({ label, href }) => ({
        label,
        href,
        badge: href === ROUTES.POC_APPROVALS ? <ApprovalCountBadge /> : undefined,
      })
    );

	return (
		<AppShell
			items={shellItems}
			logoHref={ROUTES.POC_DASHBOARD}
		>
			{children}
		</AppShell>
	);
}
