import { AuthenticationError } from "@/lib/errors";

import { getCurrentUser } from "./get-current-user";

export async function requireAuth() {
  const user =
    await getCurrentUser();

  if (!user) {
    throw new AuthenticationError();
  }

  return user;
}