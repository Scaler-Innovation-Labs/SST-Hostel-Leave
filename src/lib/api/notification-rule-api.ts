import type { SaveNotificationRuleDto } from "@/dto/notification/save-notification-rule.dto";

const BASE = "/api/v1/notification-rules";

export type NotificationRuleResponse = {
  id: string;
  leaveTypeId: string | null;
  eventType: string;
  templateId: string;
  templateCode: string;
  enabled: boolean;
  recipientTypes: string[];
  channels: string[];
  customRecipients: Array<{ type: string; value: string }>;
  createdAt: string;
  updatedAt: string;
};

export async function fetchGlobalRules(): Promise<NotificationRuleResponse[]> {
  const response = await fetch(BASE);
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error?.message ?? "Failed to fetch notification rules");
  }
  return result.data;
}

export async function createRule(
  dto: SaveNotificationRuleDto
): Promise<NotificationRuleResponse> {
  const response = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error?.message ?? "Failed to create notification rule");
  }
  return result.data;
}

export async function updateRule(
  id: string,
  dto: SaveNotificationRuleDto
): Promise<NotificationRuleResponse> {
  const response = await fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error?.message ?? "Failed to update notification rule");
  }
  return result.data;
}

export async function deleteRule(id: string): Promise<void> {
  const response = await fetch(`${BASE}/${id}`, {
    method: "DELETE",
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error?.message ?? "Failed to delete notification rule");
  }
}
