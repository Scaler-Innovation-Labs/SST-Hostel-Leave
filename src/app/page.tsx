import { Navbar } from "@/components/layout/Navbar";
import { Logo } from "@/components/shared/Logo";

import { navigation } from "@/constants/navigation";

import { HeroSection } from "@/components/landingPage/HeroSection";
import { WorkflowSection } from "@/components/landingPage/WorkflowSection";
import { FeatureGrid } from "@/components/landingPage/FeatureGrid";
import { ProductPreviewSection } from "@/components/landingPage/ProductPreviewSection";
import { BackgroundLayer } from "@/components/landingPage/BackgroundLayer";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <BackgroundLayer />

      <Navbar
        items={navigation.landing}
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