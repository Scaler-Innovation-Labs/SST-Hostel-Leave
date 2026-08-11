import { hostelRepository, type HostelRow } from "@/db/repositories/hostel/hostel.repository";

export async function listHostels(hostelIds?: string[]): Promise<HostelRow[]> {
  return hostelRepository.findAll(hostelIds);
}
