"use client";

import Link from "next/link";

import { Menu } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "../../components/ui/sheet";

import {
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

import { ProfileMenu } from "./ProfileMenu";

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

  {/* DESKTOP AUTH */}
  <div className="hidden md:flex">
    <SignedOut>
      <Link
        href="/login"
        className="
          inline-flex items-center justify-center
          rounded-xl border border-border
          bg-linear-to-r from-blue-500 to-indigo-600
          px-4 py-2
          text-sm font-medium
          text-foreground
          transition-colors
          hover:bg-accent
        "
      >
        Login
      </Link>
    </SignedOut>

    <SignedIn>
      <ProfileMenu />
    </SignedIn>
  </div>

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

        {/* MOBILE AUTH */}
        <div className="pt-4">
          <SignedOut>
            <Link
              href="/login"
              className="
                inline-flex w-full items-center
                justify-center rounded-xl
                border border-border
                bg-linear-to-r from-blue-500 to-indigo-600
                px-4 py-3
                text-sm font-medium
                text-foreground
              "
            >
              Login
            </Link>
          </SignedOut>

          <SignedIn>
            <div className="flex justify-center">
              <UserButton
                afterSignOutUrl="/"
              />
            </div>
          </SignedIn>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</div>
        </div>
      </Container>
    </header>
  );
}