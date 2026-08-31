"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { LogOut, User } from "lucide-react";
import Image from "next/image";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ProfileMenu() {
  const { signOut } = useClerk();
  const { user } = useUser();

  if (!user) return null;

  const name = user.fullName ?? "Your account";
  const email = user.primaryEmailAddress?.emailAddress ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${name}`}
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            "transition-shadow duration-fast ease-standard",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          )}
        >
          {user.imageUrl ? (
            <Image
              src={user.imageUrl}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover ring-1 ring-inset ring-border"
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-light text-accent">
              <User className="h-4 w-4" aria-hidden />
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5">
          <p className="truncate text-small font-semibold text-ink">{name}</p>
          {email && (
            <p className="truncate text-caption text-muted">{email}</p>
          )}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => signOut({ redirectUrl: "/" })}
          className="cursor-pointer text-danger"
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
