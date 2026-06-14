import { SignInButton } from "@clerk/nextjs";

import { SignOutTimer } from "@/components/shared/SignOutTimer";

export default function UnauthorizedPage() {
	return (
		<main className="min-h-screen flex flex-col items-center justify-center gap-6">
			<div className="flex flex-col items-center gap-2">
				<div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center">
					<span className="text-destructive text-xl">!</span>
				</div>
				<h1 className="text-2xl font-semibold">Unauthorized Access</h1>
				<p className="text-muted-foreground text-center max-w-md">
					Your account is not provisioned in the system.
					Please contact your administrator to get access.
				</p>
			</div>

			<div className="flex flex-col items-center gap-3">
				<SignOutTimer seconds={5} redirectUrl="/login" />

				<SignInButton mode="modal">
					<button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
						Sign In with a different account
					</button>
				</SignInButton>
			</div>
		</main>
	);
}
