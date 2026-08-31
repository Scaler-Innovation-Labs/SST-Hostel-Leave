import { ShieldAlert } from "lucide-react";

import { SignOutTimer } from "@/components/shared/SignOutTimer";
import { TECH_LABEL } from "@/design-system/sst";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-raised">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger-light text-danger ring-1 ring-inset ring-danger/20">
          <ShieldAlert className="h-7 w-7" aria-hidden />
        </span>

        <p className={`mt-5 ${TECH_LABEL}`}>Access</p>
        <h1 className="mt-2 text-h2 tracking-tight text-ink">
          This account isn&apos;t set up yet
        </h1>

        {/* What happened, why, and what to do — not "Unauthorized Access". */}
        <p className="mt-3 text-body text-muted">
          You signed in successfully, but no role has been assigned to your
          account, so there is no console to show you.
        </p>
        <p className="mt-3 text-body text-muted">
          Ask the hostel office to provision your account, then sign in again.
        </p>

        <div className="mt-8">
          <SignOutTimer seconds={5} redirectUrl="/login" />
        </div>
      </div>
    </main>
  );
}
