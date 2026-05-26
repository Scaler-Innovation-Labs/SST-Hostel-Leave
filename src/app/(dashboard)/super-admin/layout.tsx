import type { ReactNode } from "react";

type SuperAdminLayoutProps = {
	children: ReactNode;
};

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
	return (
		<div>
			{children}
		</div>
	);
}
