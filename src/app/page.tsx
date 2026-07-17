import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { Navbar } from "@/components/layout/Navbar";
import { BackgroundLayer } from "@/components/marketing/BackgroundLayer";
import { FeatureGrid } from "@/components/marketing/FeatureGrid";
import { HeroSection } from "@/components/marketing/HeroSection";
import { ProductPreviewSection } from "@/components/marketing/ProductPreviewSection";
import { WorkflowSection } from "@/components/marketing/WorkflowSection";
import { Logo } from "@/components/shared/Logo";
import { ROUTES } from "@/constants/routes";
import { NAVIGATION } from "@/constants/navigation";
import { userRoleRepository } from "@/db/repositories/auth/user-role.repository";
import { userRepository } from "@/db/repositories/user/user.repository";

function getDashboardRoute(role: string): string {
  switch (role) {
    case "SUPER_ADMIN": return ROUTES.SUPER_ADMIN_DASHBOARD;
    case "ADMIN": return ROUTES.ADMIN_DASHBOARD;
    case "POC": return ROUTES.POC_DASHBOARD;
    case "STUDENT": return ROUTES.STUDENT_DASHBOARD;
    case "GUARD": return ROUTES.GUARD_SCANNER;
    default: return "/";
  }
}

export default async function HomePage() {
  const clerkUser = await currentUser();

  if (clerkUser) {
    try {
      const dbUser = await userRepository.findByClerkId(clerkUser.id);
      if (dbUser) {
        const roleCodes = await userRoleRepository.findRoleCodesByUserId(dbUser.id);
        const dashboard = getDashboardRoute(roleCodes[0] ?? "");
        if (dashboard !== "/") {
          redirect(dashboard);
        }
      }
    } catch {
      // DB unavailable — show landing page
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <BackgroundLayer />

      <Navbar
        items={NAVIGATION.landing}
        logo={<Logo />}
      />

      <div className="space-y-6 px-8 py-8 md:space-y-8 md:py-10">
        <HeroSection />

        <ProductPreviewSection />

        <WorkflowSection />

        <FeatureGrid />
      </div>

      <footer
        className="
          border-t border-border
          py-10
        "
      >
        <div
          className="
            mx-auto flex max-w-6xl
            items-center justify-between
            px-6
          "
        >
          <p className="text-sm text-muted-foreground">
            SST Hostel Leave System
          </p>

          <p className="text-sm text-muted-foreground">
            Operational workflow platform
          </p>
        </div>
      </footer>
    </main>
  );
}