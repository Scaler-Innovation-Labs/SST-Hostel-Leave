"use client";

import Link from "next/link";

import { Menu } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "../../components/ui/sheet";

import { ThemeToggle } from "./ThemeToggle";
import { Container } from "./Container";

import { NavigationItem } from "../../constants/navigation";

type NavbarProps = {
  items: NavigationItem[];
  logo?: React.ReactNode;
};

export function Navbar({
  items,
  logo,
}: NavbarProps) {
  return (
    <header
      className="
        sticky top-0 z-50
        border-b border-border/70
        bg-background/95
        shadow-sm
        backdrop-blur-xl
      "
    >
      <Container>
        <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex items-center">
            {logo}
          </div>

          {/* DESKTOP NAV */}
          <nav className="hidden items-center justify-center gap-8 md:flex">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="
                  text-sm font-medium
                  text-muted-foreground
                  transition-colors
                  hover:text-foreground
                "
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* RIGHT */}
          <div className="flex items-center justify-end gap-3">
            <ThemeToggle />

            {/* MOBILE MENU */}
            <Sheet>
              <SheetTrigger asChild>
                <button
                  className="
                    inline-flex items-center justify-center
                    rounded-lg border border-border
                    p-2
                    md:hidden
                  "
                >
                  <Menu className="size-5" />
                </button>
              </SheetTrigger>

              <SheetContent
                side="right"
                className="w-72"
              >
                <div className="mt-10 flex flex-col gap-6">
                  {items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="
                        text-base font-medium
                        text-foreground
                        transition-colors
                        hover:text-primary
                      "
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </Container>
    </header>
  );
}