"use client";

import {
  useClerk,
  useUser,
} from "@clerk/nextjs";
import {
  LogOut,
} from "lucide-react";
import Image from "next/image";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProfileMenu() {
  const { signOut } = useClerk();

  const { user } = useUser();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="
            flex items-center gap-3
            rounded-2xl
            bg-background/60
            px-3 py-2
            transition-colors
            hover:bg-accent
          "
        >
          <Image
            src={user.imageUrl}
            alt={user.fullName ?? "User"}
            width={36}
            height={36}
            className="
              size-9 rounded-full
              object-cover
            "
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-64"
      >
        <DropdownMenuLabel>
          Account
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() =>
            signOut({
              redirectUrl: "/",
            })
          }
          className="cursor-pointer text-red-500"
        >
          <LogOut className="mr-2 size-4" />

          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}