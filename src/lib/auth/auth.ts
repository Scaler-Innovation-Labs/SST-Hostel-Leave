import { auth } from "@clerk/nextjs/server";

import {
  Role,
  ROLES,
} from "./roles";

export async function getSession() {
  return auth();
}

/*
  TEMPORARY MOCK ROLE RESOLUTION

  Later:
  - fetch from DB
  - map user → role
  - map hostel/campus
*/
export async function getCurrentUserRole(): Promise<Role> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  /*
    TEMP LOGIC
  */
  return ROLES.STUDENT;
}