import Link from "next/link";

import { NavigationItem } from "@/constants/navigation";

type SidebarProps = {
  items: NavigationItem[];
};

export function Sidebar({
  items,
}: SidebarProps) {
  return (
    <aside
      className="
        hidden w-64 shrink-0
        border-r border-border
        bg-sidebar
        lg:block
      "
    >
      <div className="flex h-full flex-col p-4">
        <div className="mb-8">
          <h2 className="text-lg font-semibold">
            Dashboard
          </h2>
        </div>

        <nav className="flex flex-col gap-2">
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="
                  flex items-center gap-3
                  rounded-xl px-3 py-2
                  text-sm font-medium
                  text-muted-foreground
                  transition-colors
                  hover:bg-sidebar-accent
                  hover:text-foreground
                "
              >
                {Icon && (
                  <Icon className="size-4" />
                )}

                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}