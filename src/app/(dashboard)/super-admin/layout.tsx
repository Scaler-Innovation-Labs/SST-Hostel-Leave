import { redirect } from "next/navigation";

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

	if (!user.roles.includes(ROLES.SUPER_ADMIN)) {
		redirect("/unauthorized");
	}

	return <SuperAdminShell>{children}</SuperAdminShell>;
}
