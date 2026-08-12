// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockListQuestions = vi.fn();
const mockAskQuestion = vi.fn();
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["ADMIN"] });

vi.mock("@/lib/db", () => ({
  db: { transaction: (cb: any) => cb({}) },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "U1", roles: ["ADMIN"] }),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/leave/leave-question.service", () => ({
  listQuestions: (...args: any[]) => mockListQuestions(...args),
  askQuestion: (...args: any[]) => mockAskQuestion(...args),
}));

import { GET, POST } from "@/app/api/v1/leaves/[id]/questions/route";

const ctx = { params: Promise.resolve({ id: "LR1" }) };

describe("GET /api/v1/leaves/[id]/questions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["ADMIN"] });
  });

  it("lists questions with default pagination", async () => {
    mockListQuestions.mockResolvedValue({
      items: [{ id: "Q1", question: "Why?", askedBy: "U1", createdAt: "2026-06-01T10:00:00Z" }],
      total: 1,
    });

    const res = await GET(new Request("http://localhost/api/v1/leaves/LR1/questions"), ctx);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockListQuestions).toHaveBeenLastCalledWith("LR1", expect.objectContaining({ page: 1, limit: 50 }));
  });

  it("forwards page and limit", async () => {
    mockListQuestions.mockResolvedValue({ items: [], total: 0 });

    await GET(
      new Request("http://localhost/api/v1/leaves/LR1/questions?page=2&limit=25"),
      ctx,
    );

    expect(mockListQuestions).toHaveBeenLastCalledWith("LR1", expect.objectContaining({ page: 2, limit: 25 }));
  });
});

describe("POST /api/v1/leaves/[id]/questions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["ADMIN"] });
  });

  it("asks a question on a leave", async () => {
    mockAskQuestion.mockResolvedValue({
      id: "Q1",
      question: "Please upload the offer letter.",
      createdAt: "2026-06-01T10:00:00Z",
    });

    const res = await POST(
      new Request("http://localhost/api/v1/leaves/LR1/questions", {
        method: "POST",
        body: JSON.stringify({ question: "Please upload the offer letter." }),
        headers: { "Content-Type": "application/json" },
      }),
      ctx,
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(mockAskQuestion).toHaveBeenLastCalledWith(
      "LR1",
      expect.objectContaining({ question: "Please upload the offer letter." }),
      expect.objectContaining({ id: "U1" }),
    );
  });

  it("rejects an empty question", async () => {
    const res = await POST(
      new Request("http://localhost/api/v1/leaves/LR1/questions", {
        method: "POST",
        body: JSON.stringify({ question: "" }),
        headers: { "Content-Type": "application/json" },
      }),
      ctx,
    );

    expect(res.status).toBe(400);
    expect(mockAskQuestion).not.toHaveBeenCalled();
  });
});
