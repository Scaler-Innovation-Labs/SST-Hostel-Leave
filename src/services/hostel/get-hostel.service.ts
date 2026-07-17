import { type Hostel,hostelRepository } from "@/db/repositories/hostel/hostel.repository";

export async function getHostelById(id: string): Promise<Hostel | null> {
  return hostelRepository.findById(id);
}
