// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockLeaveFindById = vi.fn();
const mockUserFindById = vi.fn();
const mockStudentFindByUserId = vi.fn();
const mockQuestionCreate = vi.fn();
const mockQuestionFindById = vi.fn();
const mockQuestionUpdateAnswer = vi.fn();
const mockQuestionFindByLeaveRequestId = vi.fn();

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockLeaveFindById(...args),
  },
}));

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    findById: (...args: any[]) => mockUserFindById(...args),
  },
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findByUserId: (...args: any[]) => mockStudentFindByUserId(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-question.repository", () => ({
  leaveQuestionRepository: {
    create: (...args: any[]) => mockQuestionCreate(...args),
    findById: (...args: any[]) => mockQuestionFindById(...args),
    updateAnswer: (...args: any[]) => mockQuestionUpdateAnswer(...args),
    findByLeaveRequestId: (...args: any[]) => mockQuestionFindByLeaveRequestId(...args),
  },
}));

import { askQuestion, answerQuestion, listQuestions } from "@/services/leave/leave-question.service";
import { NotFoundError, ValidationError } from "@/lib/errors";

const MOCK_LEAVE = { id: "LR1", studentId: "S1" };
const MOCK_USER = { id: "U1", fullName: "Admin User" };
const MOCK_STUDENT = { id: "S1" };

const MOCK_QUESTION = {
  id: "Q1",
  leaveRequestId: "LR1",
  askedBy: "U1",
  askedByRole: "ADMIN",
  askedByName: "Admin User",
  question: "Why do you need leave?",
  answer: null,
  status: "pending",
  createdAt: new Date("2026-01-01"),
  answeredAt: null,
};

const MOCK_ANSWERED = {
  ...MOCK_QUESTION,
  answer: "Family emergency",
  status: "answered",
  answeredAt: new Date("2026-01-02"),
};

beforeEach(() => {
  vi.resetAllMocks();
  mockLeaveFindById.mockResolvedValue(MOCK_LEAVE);
  mockUserFindById.mockResolvedValue(MOCK_USER);
  mockStudentFindByUserId.mockResolvedValue(MOCK_STUDENT);
  mockQuestionCreate.mockResolvedValue(MOCK_QUESTION);
  mockQuestionFindById.mockResolvedValue(MOCK_QUESTION);
  mockQuestionUpdateAnswer.mockResolvedValue(MOCK_ANSWERED);
  mockQuestionFindByLeaveRequestId.mockResolvedValue({ items: [MOCK_QUESTION], total: 1 });
});

describe("askQuestion service", () => {
  it("creates a question on a leave", async () => {
    const result = await askQuestion("LR1", { question: "Why do you need leave?" }, { id: "U1", roles: ["ADMIN"] });

    expect(result.question).toBe("Why do you need leave?");
    expect(result.status).toBe("pending");
    expect(result.askedByName).toBe("Admin User");
    expect(mockQuestionCreate).toHaveBeenCalledWith(expect.objectContaining({
      leaveRequestId: "LR1",
      askedBy: "U1",
      question: "Why do you need leave?",
    }));
  });

  it("throws NotFoundError when leave does not exist", async () => {
    mockLeaveFindById.mockResolvedValue(null);

    await expect(askQuestion("NONEXISTENT", { question: "Test?" }, { id: "U1", roles: ["ADMIN"] }))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError when user does not exist", async () => {
    mockUserFindById.mockResolvedValue(null);

    await expect(askQuestion("LR1", { question: "Test?" }, { id: "U1", roles: ["ADMIN"] }))
      .rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("answerQuestion service", () => {
  it("answers a question", async () => {
    const result = await answerQuestion("LR1", "Q1", { answer: "Family emergency" }, { id: "U1" });

    expect(result.answer).toBe("Family emergency");
    expect(result.status).toBe("answered");
    expect(mockQuestionUpdateAnswer).toHaveBeenCalledWith("Q1", "Family emergency");
  });

  it("throws NotFoundError when leave does not exist", async () => {
    mockLeaveFindById.mockResolvedValue(null);

    await expect(answerQuestion("NONEXISTENT", "Q1", { answer: "Test" }, { id: "U1" }))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError when student does not own leave", async () => {
    mockStudentFindByUserId.mockResolvedValue({ id: "S2" });

    await expect(answerQuestion("LR1", "Q1", { answer: "Test" }, { id: "U1" }))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ValidationError when question already answered", async () => {
    mockQuestionFindById.mockResolvedValue({ ...MOCK_QUESTION, status: "answered" });

    await expect(answerQuestion("LR1", "Q1", { answer: "Test" }, { id: "U1" }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it("throws NotFoundError when question not on this leave", async () => {
    mockQuestionFindById.mockResolvedValue({ ...MOCK_QUESTION, leaveRequestId: "LR2" });

    await expect(answerQuestion("LR1", "Q1", { answer: "Test" }, { id: "U1" }))
      .rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("listQuestions service", () => {
  it("lists questions for a leave", async () => {
    const result = await listQuestions("LR1", { page: 1, limit: 20 }, { id: "U1", roles: ["ADMIN"] });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.question).toBe("Why do you need leave?");
    expect(mockQuestionFindByLeaveRequestId).toHaveBeenCalledWith("LR1", { page: 1, limit: 20 });
  });

  it("throws NotFoundError when leave does not exist", async () => {
    mockLeaveFindById.mockResolvedValue(null);

    await expect(listQuestions("NONEXISTENT", { page: 1, limit: 20 }, { id: "U1", roles: ["ADMIN"] }))
      .rejects.toBeInstanceOf(NotFoundError);
  });
});
