import type { ApiResponse } from "@/types/api";

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
