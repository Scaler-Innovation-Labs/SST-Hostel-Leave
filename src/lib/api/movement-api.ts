import type { ListMovementsQuery } from "@/dto/movement/list-movements.dto";
import { buildQueryString } from "@/lib/api/query-string";
import type { ApiResponse } from "@/types/api";

const BASE = "/api/v1";

export function getMovementsUrl(query?: Partial<ListMovementsQuery>): string {
  const qs = buildQueryString({
    studentId: query?.studentId,
    eventType: query?.eventType,
    search: query?.search,
    dateFrom: query?.dateFrom,
    dateTo: query?.dateTo,
    leaveRequestId: query?.leaveRequestId,
    page: query?.page,
    limit: query?.limit,
  });
  return `${BASE}/movements${qs ? `?${qs}` : ""}`;
}

export async function generateQr(
  leaveRequestId: string,
  qrType: "LEAVE_EXIT" | "LEAVE_RETURN",
): Promise<unknown> {
  const res = await fetch(`${BASE}/movements/generate-qr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leaveRequestId, qrType }),
  });
  const json: ApiResponse = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to generate QR");
  }
  return json.data;
}

export async function invalidateQr(
  qrPassId: string,
  reason?: string,
): Promise<unknown> {
  const res = await fetch(`${BASE}/movements/qr-passes/invalidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ qrPassId, reason }),
  });
  const json: ApiResponse = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to invalidate QR pass");
  }
  return json.data;
}

export async function scanQr(
  token: string,
): Promise<unknown> {
  const res = await fetch(`${BASE}/movements/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const json: ApiResponse = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to scan QR");
  }
  return json.data;
}
