import { hostelRepository } from "@/db/repositories/hostel/hostel.repository";

export async function listHostels() {
  return hostelRepository.findAll();
}
