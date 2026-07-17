import type { WebhookEvent } from "@clerk/nextjs/server";

import { userRepository } from "@/db/repositories/user/user.repository";

export async function handleClerkWebhookEvent(evt: WebhookEvent): Promise<void> {
  switch (evt.type) {
    case "user.created": {
      const { id, email_addresses, first_name, last_name, image_url } = evt.data;
      const email = email_addresses?.[0]?.email_address ?? null;
      const fullName = [first_name, last_name].filter(Boolean).join(" ") || "Unknown";

      const existingByClerkId = await userRepository.findByClerkId(id);
      if (existingByClerkId) {
        break;
      }

      if (email) {
        const existingByEmail = await userRepository.findByEmail(email);
        if (existingByEmail) {
          await userRepository.updateClerkId(existingByEmail.id, id);
          break;
        }
      }

      await userRepository.create({
        clerkId: id,
        fullName,
        email: email ?? undefined,
        profileImageUrl: image_url ?? undefined,
      });
      break;
    }

    case "user.updated": {
      const { id, email_addresses, first_name, last_name, image_url } = evt.data;
      const email = email_addresses?.[0]?.email_address ?? null;
      const fullName = [first_name, last_name].filter(Boolean).join(" ") || "Unknown";

      await userRepository.updateProfile(id, {
        fullName,
        email: email ?? undefined,
        profileImageUrl: image_url ?? undefined,
      });
      break;
    }

    case "user.deleted": {
      const { id } = evt.data;
      if (id) {
        await userRepository.softDelete(id);
      }
      break;
    }
  }
}
