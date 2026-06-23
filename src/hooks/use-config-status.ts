"use client";

import useSWR from "swr";

export type ConfigStatus = {
  email: {
    configured: boolean;
    apiKey: boolean;
    fromEmail: boolean;
  };
  sms: {
    configured: boolean;
    accountSid: boolean;
    authToken: boolean;
    phoneNumber: boolean;
  };
  slack: {
    configured: boolean;
    botToken: boolean;
    channelId: boolean;
  };
  system: {
    baseUrl: boolean;
    appUrl: boolean;
    authSecret: boolean;
  };
};

export function useConfigStatus() {
  const { data, error, isLoading, mutate } = useSWR("/api/v1/admin/config");

  return {
    status: (data?.data as ConfigStatus) ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
