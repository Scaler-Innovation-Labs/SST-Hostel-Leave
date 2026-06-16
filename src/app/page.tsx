import { Navbar } from "@/components/layout/Navbar";
import { BackgroundLayer } from "@/components/marketing/BackgroundLayer";
import { FeatureGrid } from "@/components/marketing/FeatureGrid";
import { HeroSection } from "@/components/marketing/HeroSection";
import { ProductPreviewSection } from "@/components/marketing/ProductPreviewSection";
import { WorkflowSection } from "@/components/marketing/WorkflowSection";
import { Logo } from "@/components/shared/Logo";
import { NAVIGATION } from "@/constants/navigation";

export default function HomePage() {
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