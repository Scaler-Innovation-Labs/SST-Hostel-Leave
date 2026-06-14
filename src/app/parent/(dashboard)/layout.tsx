import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { ROUTES } from "@/constants/routes";
import { verifyParentJwt, PARENT_JWT_COOKIE } from "@/lib/jwt";
import { NotFoundError } from "@/lib/errors";
import { parentRepository } from "@/db/repositories/hostel/parent.repository";
import type { Parent } from "@/db/repositories/hostel/parent.repository";

type ParentDashboardLayoutProps = {
  children: React.ReactNode;
};

export default async function ParentDashboardLayout({
  children,
}: ParentDashboardLayoutProps) {
  const cookieStore = await cookies();
  const token = cookieStore.get(PARENT_JWT_COOKIE)?.value;

  if (!token) {
    redirect(ROUTES.PARENT_LOGIN);
  }

  let parent: Parent;
  try {
    const payload = await verifyParentJwt(token);
    const found = await parentRepository.findById(payload.sub);
    if (!found) throw new NotFoundError("Parent");
    parent = found;
  } catch {
    redirect(ROUTES.PARENT_LOGIN);
  }

  const items = [
    { label: "Dashboard", href: ROUTES.PARENT_DASHBOARD },
    { label: "Approvals", href: ROUTES.PARENT_APPROVALS },
    { label: "History", href: ROUTES.PARENT_HISTORY },
    { label: "Settings", href: ROUTES.PARENT_SETTINGS },
  ];

  return (
    <AppShell items={items}>
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Welcome, {parent.name}
        </p>
        {children}
      </div>
    </AppShell>
  );
}
