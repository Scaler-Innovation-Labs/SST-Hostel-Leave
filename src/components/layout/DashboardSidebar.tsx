import { Sidebar } from "./Sidebar";

type SidebarNavItem = {
  label: string;
  href: string;
};

type DashboardSidebarProps = {
  items: SidebarNavItem[];
};

export function DashboardSidebar({
  items,
}: DashboardSidebarProps) {
  return <Sidebar items={items} />;
}
