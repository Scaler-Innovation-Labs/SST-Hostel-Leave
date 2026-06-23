import type { ApiResponse } from "@/types/api";

export async function sendParentOtp(token: string, phone: string): Promise<unknown> {
  const res = await fetch(`/api/parent-approve/${token}/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  const json: ApiResponse = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to send OTP");
  }
  return json.data;
}

export async function verifyParentOtp(token: string, otp: string): Promise<unknown> {
  const res = await fetch(`/api/parent-approve/${token}/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ otp }),
  });
  const json: ApiResponse = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to verify OTP");
  }
  return json.data;
}

export async function submitParentDecision(
  token: string,
  decision: "APPROVED" | "REJECTED",
  comments?: string
): Promise<unknown> {
  const res = await fetch(`/api/parent-approve/${token}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, comments }),
  });
  const json: ApiResponse = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to submit decision");
  }
  return json.data;
}
