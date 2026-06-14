import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/authorization";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { ROLES } from "@/lib/auth/roles";

import { SuperAdminShell } from "./SuperAdminShell";

type SuperAdminLayoutProps = {
	children: React.ReactNode;
};

export default async function SuperAdminLayout({
	children,
}: SuperAdminLayoutProps) {
	const user = await getCurrentUser();

	if (!user) {
		redirect("/unauthorized");
	}

	requireRole(user, ROLES.SUPER_ADMIN);

	return <SuperAdminShell>{children}</SuperAdminShell>;
}
