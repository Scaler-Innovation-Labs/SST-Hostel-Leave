"use client";

import { useUser } from "@clerk/nextjs";

import type { Role } from "@/lib/auth/roles";

export function useCurrentUser() {
  const { user, isLoaded, isSignedIn } = useUser();

  return {
    user,
    isLoaded,
    isSignedIn,
    userId: user?.id ?? null,
    roles: (user?.publicMetadata?.roles as Role[]) ?? [],
    fullName: user?.fullName ?? null,
    email: user?.emailAddresses?.[0]?.emailAddress ?? null,
    imageUrl: user?.imageUrl ?? null,
  };
}
