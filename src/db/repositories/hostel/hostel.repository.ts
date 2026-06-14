import { asc } from "drizzle-orm";
import { hostels } from "@/db/schema/hostel";
import { db } from "@/lib/db";

type HostelSelectDbClient = Pick<typeof db, "select">;

export type HostelRow = {
  id: string;
  code: string;
  name: string;
};

export const hostelRepository = {
  async findAll(
    dbClient: HostelSelectDbClient = db
  ): Promise<HostelRow[]> {
    return dbClient
      .select({ id: hostels.id, code: hostels.code, name: hostels.name })
      .from(hostels)
      .orderBy(asc(hostels.name));
  },
};

export default hostelRepository;
