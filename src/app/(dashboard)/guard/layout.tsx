import { redirect } from "next/navigation";

import { FieldShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { ROLES } from "@/lib/auth/roles";

type GuardLayoutProps = {
  children: React.ReactNode;
};

/**
 * The gate has one screen and one task, so it gets the field shell rather than
 * the sidebar: no nested navigation, single column at every width, and guard
 * density throughout — 64px targets and 18px body for gloved, one-handed use
 * in direct sunlight.
 */
export default async function GuardLayout({ children }: GuardLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/unauthorized");
  }

  if (!user.roles.includes(ROLES.GUARD)) {
    redirect("/unauthorized");
  }

  return <FieldShell roleLabel="Gate">{children}</FieldShell>;
}
