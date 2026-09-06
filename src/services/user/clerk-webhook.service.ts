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

      // Concurrent duplicate deliveries race the check-then-insert above.
      // The clerk_id unique index rejects the loser with 23505 — refetch
      // the winner instead of surfacing an opaque 500.
      try {
        await userRepository.create({
          clerkId: id,
          fullName,
          email: email ?? undefined,
          profileImageUrl: image_url ?? undefined,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          (error as { code?: unknown }).code === "23505"
        ) {
          break;
        }
        throw error;
      }
      break;
    }

    case "user.updated": {
      const { id, email_addresses, first_name, last_name, image_url } = evt.data;
      const email = email_addresses?.[0]?.email_address ?? null;
      const fullName = [first_name, last_name].filter(Boolean).join(" ") || "Unknown";

      // Repositories key on the internal PK — resolve the Clerk id first,
      // otherwise profile sync is a silent no-op.
      const existing = await userRepository.findByClerkId(id);
      if (!existing) break;

      await userRepository.updateProfile(existing.id, {
        fullName,
        email: email ?? undefined,
        profileImageUrl: image_url ?? undefined,
      });
      break;
    }

    case "user.deleted": {
      const { id } = evt.data;
      if (!id) break;
      // Same internal-PK resolution: without it deprovisioning silently
      // no-ops and ex-staff rows stay active.
      const existing = await userRepository.findByClerkId(id);
      if (!existing) break;
      await userRepository.softDelete(existing.id);
      break;
    }
  }
}
