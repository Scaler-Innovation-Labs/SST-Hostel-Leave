import type { ReactNode } from "react";

type POCLayoutProps = {
	children: ReactNode;
};

export default function POCLayout({ children }: POCLayoutProps) {
	return (
		<div>
			{children}
		</div>
	);
}
