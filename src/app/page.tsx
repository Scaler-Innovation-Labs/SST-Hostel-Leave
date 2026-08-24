import { Navbar } from "@/components/layout/Navbar";
import { BackgroundLayer } from "@/components/marketing/BackgroundLayer";
import { CtaSection } from "@/components/marketing/CtaSection";
import { FeatureGrid } from "@/components/marketing/FeatureGrid";
import { HeroSection } from "@/components/marketing/HeroSection";
import { ProductPreviewSection } from "@/components/marketing/ProductPreviewSection";
import { WorkflowSection } from "@/components/marketing/WorkflowSection";
import { ForceDarkMode } from "@/components/shared/ForceDarkMode";
import { Logo } from "@/components/shared/Logo";
import { NAVIGATION } from "@/constants/navigation";
import { ROUTES } from "@/constants/routes";

const FOOTER_COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Workflow", href: "#workflow" },
      { label: "Preview", href: "#security" },
    ],
  },
  {
    heading: "Portals",
    links: [
      { label: "Student", href: ROUTES.STUDENT_DASHBOARD },
      { label: "POC", href: ROUTES.POC_DASHBOARD },
      { label: "Admin", href: ROUTES.ADMIN_DASHBOARD },
      { label: "Guard Scanner", href: ROUTES.GUARD_SCANNER },
    ],
  },
];

export default async function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <ForceDarkMode />
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

        <CtaSection />
      </div>

      <footer
        className="
          border-t border-border
          py-12
        "
      >
        <div
          className="
            mx-auto grid max-w-6xl gap-10 px-6
            md:grid-cols-[1fr_auto_auto]
          "
        >
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
              Campus leave and movement management — approvals, QR passes,
              and audit trails in one platform.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {column.heading}
              </h3>

              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="
            mx-auto mt-10 flex max-w-6xl items-center
            justify-between border-t border-border px-6 pt-6
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
