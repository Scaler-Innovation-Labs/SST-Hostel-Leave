"use client";

import useSWR from "swr";

export type NotificationTemplate = {
  id: string;
  code: string;
  eventKey: string;
  channel: string;
  subject: string | null;
  templateBody: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const TEMPLATES_URL = "/api/v1/notification-templates";

export function useNotificationTemplates() {
  const { data, error, isLoading, mutate } = useSWR(TEMPLATES_URL);

  return {
    templates: (data?.data as NotificationTemplate[]) ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

export async function createTemplate(input: {
  code: string;
  eventKey: string;
  channel: string;
  subject?: string | null;
  templateBody: string;
  isActive?: boolean;
}): Promise<NotificationTemplate> {
  const res = await fetch(TEMPLATES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "Failed to create template");
  return json.data;
}

export async function updateTemplate(
  id: string,
  input: Partial<{
    eventKey: string;
    channel: string;
    subject: string | null;
    templateBody: string;
    isActive: boolean;
  }>,
): Promise<NotificationTemplate> {
  const res = await fetch(`${TEMPLATES_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "Failed to update template");
  return json.data;
}

export async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`${TEMPLATES_URL}/${id}`, {
    method: "DELETE",
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "Failed to delete template");
}

export async function toggleTemplateActive(id: string, isActive: boolean): Promise<NotificationTemplate> {
  return updateTemplate(id, { isActive });
}
