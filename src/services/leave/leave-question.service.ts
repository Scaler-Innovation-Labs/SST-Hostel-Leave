import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveQuestionRepository } from "@/db/repositories/leave/leave-question.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import type { AnswerLeaveQuestionDto } from "@/dto/leave/answer-leave-question.dto";
import type { CreateLeaveQuestionDto } from "@/dto/leave/create-leave-question.dto";
import type { CurrentUser } from "@/lib/auth/types";
import { NotFoundError } from "@/lib/errors/not-found-error";
import { ValidationError } from "@/lib/errors/validation-error";
import { assertCanAccessLeave } from "@/services/shared/authorization.service";

export type LeaveQuestionResult = {
  id: string;
  leaveRequestId: string;
  askedBy: string;
  askedByRole: string;
  askedByName: string;
  question: string;
  answer: string | null;
  status: string;
  createdAt: string;
  answeredAt: string | null;
};

export type ListLeaveQuestionsResult = {
  items: LeaveQuestionResult[];
  total: number;
};

export async function askQuestion(
  leaveId: string,
  dto: CreateLeaveQuestionDto,
  currentUser: CurrentUser,
): Promise<LeaveQuestionResult> {
  const leave = await leaveRepository.findById(leaveId);
  if (!leave) throw new NotFoundError("Leave request not found");

  await assertCanAccessLeave(currentUser, leave);

  const user = await userRepository.findById(currentUser.id);
  if (!user) throw new NotFoundError("User not found");

  const question = await leaveQuestionRepository.create({
    leaveRequestId: leaveId,
    askedBy: currentUser.id,
    askedByRole: currentUser.roles[0] ?? "ADMIN",
    askedByName: user.fullName,
    question: dto.question,
  });

  return {
    id: question.id,
    leaveRequestId: question.leaveRequestId,
    askedBy: question.askedBy,
    askedByRole: question.askedByRole,
    askedByName: question.askedByName,
    question: question.question,
    answer: question.answer,
    status: question.status,
    createdAt: question.createdAt.toISOString(),
    answeredAt: question.answeredAt?.toISOString() ?? null,
  };
}

export async function answerQuestion(
  leaveId: string,
  questionId: string,
  dto: AnswerLeaveQuestionDto,
  currentUser: { id: string },
): Promise<LeaveQuestionResult> {
  const leave = await leaveRepository.findById(leaveId);
  if (!leave) throw new NotFoundError("Leave request not found");

  const student = await studentRepository.findByUserId(currentUser.id);
  if (!student || student.id !== leave.studentId) {
    throw new NotFoundError("Leave request not found");
  }

  const question = await leaveQuestionRepository.findById(questionId);
  if (!question) throw new NotFoundError("Question not found");
  if (question.status === "answered") throw new ValidationError("Question already answered");
  if (question.leaveRequestId !== leaveId) throw new NotFoundError("Question not found on this leave");

  const updated = await leaveQuestionRepository.updateAnswer(questionId, dto.answer);
  if (!updated) throw new NotFoundError("Failed to update question");

  return {
    id: updated.id,
    leaveRequestId: updated.leaveRequestId,
    askedBy: updated.askedBy,
    askedByRole: updated.askedByRole,
    askedByName: updated.askedByName,
    question: updated.question,
    answer: updated.answer,
    status: updated.status,
    createdAt: updated.createdAt.toISOString(),
    answeredAt: updated.answeredAt?.toISOString() ?? null,
  };
}

export async function listQuestions(
  leaveId: string,
  pagination: { page: number; limit: number },
  currentUser: CurrentUser,
): Promise<ListLeaveQuestionsResult> {
  const leave = await leaveRepository.findById(leaveId);
  if (!leave) throw new NotFoundError("Leave request not found");

  await assertCanAccessLeave(currentUser, leave);

  const { items, total } = await leaveQuestionRepository.findByLeaveRequestId(leaveId, pagination);

  return {
    items: items.map((q) => ({
      id: q.id,
      leaveRequestId: q.leaveRequestId,
      askedBy: q.askedBy,
      askedByRole: q.askedByRole,
      askedByName: q.askedByName,
      question: q.question,
      answer: q.answer,
      status: q.status,
      createdAt: q.createdAt.toISOString(),
      answeredAt: q.answeredAt?.toISOString() ?? null,
    })),
    total,
  };
}
