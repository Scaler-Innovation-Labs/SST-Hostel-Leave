import { Logo } from "@/components/shared/Logo";
import type { NavigationItem } from "@/constants/navigation";

import { Navbar } from "./Navbar";

type DashboardNavbarProps = {
  items: NavigationItem[];
  logoHref?: string;
};

export function DashboardNavbar({
  items,
  logoHref,
}: DashboardNavbarProps) {
  const navItems = items.map(
    ({ label, href, icon, badge }) => ({
      label,
      href,
      icon,
      badge,
    })
  );

  return (
    <Navbar
      items={navItems}
      logo={<Logo href={logoHref} />}
    />
  );
}
