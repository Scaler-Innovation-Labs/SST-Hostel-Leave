"use client";

const STORAGE_KEY = "qr_tokens";

function loadTokens(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveTokens(tokens: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export function useQrToken() {
  const getToken = (passId: string): string | null => {
    const tokens = loadTokens();
    return tokens[passId] ?? null;
  };

  const getTokenByLeaveId = (leaveRequestId: string): string | null => {
    const tokens = loadTokens();
    return tokens[`leave:${leaveRequestId}`] ?? null;
  };

  const storeToken = (passId: string, token: string, leaveRequestId?: string): void => {
    const tokens = loadTokens();
    tokens[passId] = token;
    if (leaveRequestId) {
      tokens[`leave:${leaveRequestId}`] = token;
    }
    saveTokens(tokens);
  };

  const removeToken = (passId: string): void => {
    const tokens = loadTokens();
    delete tokens[passId];
    saveTokens(tokens);
  };

  const clearTokens = (): void => {
    saveTokens({});
  };

  return { getToken, getTokenByLeaveId, storeToken, removeToken, clearTokens };
}
