// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindGlobal = vi.fn();
const mockFindByLeaveType = vi.fn();
const mockFindById = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/db/repositories/notification/notification-rule.repository", () => ({
  notificationRuleRepository: {
    findGlobal: (...args: any[]) => mockFindGlobal(...args),
    findByLeaveType: (...args: any[]) => mockFindByLeaveType(...args),
    findById: (...args: any[]) => mockFindById(...args),
    create: (...args: any[]) => mockCreate(...args),
    update: (...args: any[]) => mockUpdate(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
}));

import { getGlobalRules, getRulesByLeaveType, getNotificationRuleById, createNotificationRule, updateNotificationRule, deleteNotificationRule } from "@/services/notification/notification-rule.service";
import { NotFoundError } from "@/lib/errors";

const MOCK_ROW = {
  id: "NR1",
  leaveTypeId: null,
  eventType: "LEAVE_APPROVED",
  templateId: "T1",
  templateCode: "LEAVE_APPROVED",
  enabled: true,
  recipients: [{ recipientType: "STUDENT" }],
  channels: [{ channel: "EMAIL" }],
  customRecipients: [],
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const MOCK_RESPONSE = {
  id: "NR1",
  leaveTypeId: null,
  eventType: "LEAVE_APPROVED",
  templateId: "T1",
  templateCode: "LEAVE_APPROVED",
  enabled: true,
  recipientTypes: ["STUDENT"],
  channels: ["EMAIL"],
  customRecipients: [],
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

beforeEach(() => {
  vi.resetAllMocks();
  mockFindGlobal.mockResolvedValue([MOCK_ROW]);
  mockFindByLeaveType.mockResolvedValue([MOCK_ROW]);
  mockFindById.mockResolvedValue(MOCK_ROW);
  mockCreate.mockResolvedValue("NR1");
  mockUpdate.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
});

describe("getGlobalRules service", () => {
  it("returns global notification rules", async () => {
    const result = await getGlobalRules();

    expect(result).toEqual([MOCK_RESPONSE]);
    expect(mockFindGlobal).toHaveBeenCalled();
  });
});

describe("getRulesByLeaveType service", () => {
  it("returns rules for a leave type", async () => {
    const result = await getRulesByLeaveType("LT1");

    expect(result).toEqual([MOCK_RESPONSE]);
    expect(mockFindByLeaveType).toHaveBeenCalledWith("LT1");
  });
});

describe("getNotificationRuleById service", () => {
  it("returns rule by id", async () => {
    const result = await getNotificationRuleById("NR1");

    expect(result).toEqual(MOCK_RESPONSE);
    expect(mockFindById).toHaveBeenCalledWith("NR1");
  });

  it("throws NotFoundError when rule does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(getNotificationRuleById("NONEXISTENT")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("createNotificationRule service", () => {
  const CREATE_DTO = {
    eventType: "LEAVE_APPROVED",
    templateId: "T1",
    enabled: true,
    recipientTypes: ["STUDENT"],
    channels: ["EMAIL"],
    customRecipients: [],
  };

  it("creates a notification rule", async () => {
    const result = await createNotificationRule(null, CREATE_DTO);

    expect(result).toEqual(MOCK_RESPONSE);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ ...CREATE_DTO, leaveTypeId: null }));
    expect(mockFindById).toHaveBeenCalledWith("NR1");
  });
});

describe("updateNotificationRule service", () => {
  const UPDATE_DTO = {
    eventType: "LEAVE_APPROVED",
    templateId: "T1",
    enabled: false,
    recipientTypes: ["STUDENT"],
    channels: ["EMAIL"],
    customRecipients: [],
  };

  it("updates a notification rule", async () => {
    const result = await updateNotificationRule("NR1", null, UPDATE_DTO);

    expect(result).toEqual(MOCK_RESPONSE);
    expect(mockUpdate).toHaveBeenCalledWith("NR1", expect.objectContaining({ ...UPDATE_DTO, leaveTypeId: null }));
  });
});

describe("deleteNotificationRule service", () => {
  it("deletes a notification rule", async () => {
    await deleteNotificationRule("NR1");

    expect(mockDelete).toHaveBeenCalledWith("NR1");
  });
});
