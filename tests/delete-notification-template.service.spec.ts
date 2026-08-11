// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindById = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/db/repositories/notification/notification-template.repository", () => ({
  notificationTemplateRepository: {
    findById: (...args: any[]) => mockFindById(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
}));

import { deleteNotificationTemplate } from "@/services/notification/delete-notification-template.service";
import { NotFoundError } from "@/lib/errors";

beforeEach(() => {
  vi.resetAllMocks();
  mockFindById.mockResolvedValue({ id: "T1", code: "LEAVE_APPROVED" });
  mockDelete.mockResolvedValue(undefined);
});

describe("deleteNotificationTemplate service", () => {
  it("deletes a notification template", async () => {
    const result = await deleteNotificationTemplate("T1");

    expect(result).toEqual({ deleted: true });
    expect(mockFindById).toHaveBeenCalledWith("T1");
    expect(mockDelete).toHaveBeenCalledWith("T1");
  });

  it("throws NotFoundError when template does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(deleteNotificationTemplate("NONEXISTENT")).rejects.toBeInstanceOf(NotFoundError);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
