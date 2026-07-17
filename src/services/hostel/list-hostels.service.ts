import { hostelRepository, type HostelRow } from "@/db/repositories/hostel/hostel.repository";

export async function listHostels(): Promise<HostelRow[]> {
  return hostelRepository.findAll();
}
