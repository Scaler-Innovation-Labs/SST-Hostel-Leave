import { Logo } from "@/components/shared/Logo";
import type { NavigationItem } from "@/constants/navigation";

import { Navbar } from "./Navbar";

type DashboardNavbarProps = {
  items: NavigationItem[];
};

export function DashboardNavbar({
  items,
}: DashboardNavbarProps) {
  const navItems = items.map(
    ({ label, href }) => ({
      label,
      href,
    })
  );

  return (
    <Navbar
      items={navItems}
      logo={<Logo />}
    />
  );
}
