import { eq } from "drizzle-orm";

import { users } from "@/db";
import { db } from "@/lib/db";

export type User = {
  id: string;
  clerkId: string | null;
  hostelId: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  profileImageUrl: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export const userRepository = {
  async findById(
    id: string,
    dbClient: Pick<typeof db, "select"> = db
  ) {
    const rows = await dbClient
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return rows[0] ?? null;
  },

  async findByClerkId(
    clerkId: string,
    dbClient: Pick<typeof db, "select"> = db
  ) {
    const rows = await dbClient
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    return rows[0] ?? null;
  },

  async findByEmail(
    email: string,
    dbClient: Pick<typeof db, "select"> = db
  ) {
    const rows = await dbClient
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return rows[0] ?? null;
  },

  async create(
    input: {
      fullName: string;
      email?: string;
      phone?: string;
      gender?: "MALE" | "FEMALE" | "OTHER" | null;
      clerkId?: string;
      hostelId?: string;
      isActive?: boolean;
      profileImageUrl?: string;
    },
    dbClient: Pick<typeof db, "insert"> = db
  ) {
    const rows = await dbClient
      .insert(users)
      .values({
        fullName: input.fullName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        gender: input.gender ?? null as "MALE" | "FEMALE" | "OTHER" | null,
        clerkId: input.clerkId ?? null,
        hostelId: input.hostelId ?? null,
        isActive: input.isActive ?? true,
        profileImageUrl: input.profileImageUrl ?? null,
      })
      .returning();

    return rows[0]!;
  },

  async updateClerkId(
    id: string,
    clerkId: string,
    dbClient: Pick<typeof db, "update"> = db
  ) {
    const rows = await dbClient
      .update(users)
      .set({ clerkId })
      .where(eq(users.id, id))
      .returning();

    return rows[0] ?? null;
  },

  async updateProfile(
    id: string,
    input: {
      fullName?: string;
      email?: string;
      profileImageUrl?: string | null;
    },
    dbClient: Pick<typeof db, "update"> = db
  ) {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (input.fullName !== undefined) set.fullName = input.fullName;
    if (input.email !== undefined) set.email = input.email;
    if (input.profileImageUrl !== undefined) set.profileImageUrl = input.profileImageUrl;

    const rows = await dbClient
      .update(users)
      .set(set)
      .where(eq(users.id, id))
      .returning();

    return rows[0] ?? null;
  },

  async softDelete(
    id: string,
    dbClient: Pick<typeof db, "update"> = db
  ) {
    const rows = await dbClient
      .update(users)
      .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    return rows[0] ?? null;
  },
};

export default userRepository;
