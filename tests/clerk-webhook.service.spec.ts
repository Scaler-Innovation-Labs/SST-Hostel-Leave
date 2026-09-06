// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindByClerkId = vi.fn();
const mockUpdateProfile = vi.fn();
const mockSoftDelete = vi.fn();

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    findByClerkId: (...args: any[]) => mockFindByClerkId(...args),
    findByEmail: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    updateProfile: (...args: any[]) => mockUpdateProfile(...args),
    softDelete: (...args: any[]) => mockSoftDelete(...args),
    updateClerkId: vi.fn(),
  },
}));

import { handleClerkWebhookEvent } from "@/services/user/clerk-webhook.service";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("handleClerkWebhookEvent clerk-id resolution", () => {
  it("resolves internal PK before profile sync", async () => {
    mockFindByClerkId.mockResolvedValue({ id: "DB1" });

    await handleClerkWebhookEvent({
      type: "user.updated",
      data: {
        id: "clerk_123",
        email_addresses: [{ email_address: "a@b.c" }],
        first_name: "A",
        last_name: "B",
        image_url: null,
      },
    } as any);

    expect(mockUpdateProfile).toHaveBeenCalledWith(
      "DB1",
      expect.objectContaining({ fullName: "A B" })
    );
  });

  it("skips profile sync when no DB row matches the Clerk id", async () => {
    mockFindByClerkId.mockResolvedValue(null);

    await handleClerkWebhookEvent({
      type: "user.updated",
      data: { id: "clerk_unknown", email_addresses: [] },
    } as any);

    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("resolves internal PK before soft delete", async () => {
    mockFindByClerkId.mockResolvedValue({ id: "DB9" });

    await handleClerkWebhookEvent({
      type: "user.deleted",
      data: { id: "clerk_9" },
    } as any);

    expect(mockSoftDelete).toHaveBeenCalledWith("DB9");
  });

  it("never passes a Clerk id as the internal PK", async () => {
    mockFindByClerkId.mockResolvedValue({ id: "DB1" });

    await handleClerkWebhookEvent({
      type: "user.updated",
      data: { id: "clerk_123", email_addresses: [] },
    } as any);
    await handleClerkWebhookEvent({
      type: "user.deleted",
      data: { id: "clerk_123" },
    } as any);

    for (const call of [...mockUpdateProfile.mock.calls, ...mockSoftDelete.mock.calls]) {
      expect(call[0]).not.toMatch(/^clerk_/);
    }
  });
});
