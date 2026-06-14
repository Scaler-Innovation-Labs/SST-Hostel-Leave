import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { navigation } from "@/constants/navigation";
import { ROUTES } from "@/constants/routes";
import { requireRole } from "@/lib/auth/authorization";
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

	requireRole(user, ROLES.POC);

	const shellItems =
		navigation.poc.map(
			({ label, href }) => ({
				label,
				href,
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
