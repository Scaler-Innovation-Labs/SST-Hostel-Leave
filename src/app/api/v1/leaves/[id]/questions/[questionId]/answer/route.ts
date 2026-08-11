import answerLeaveQuestionSchema from "@/dto/leave/answer-leave-question.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { answerQuestion } from "@/services/leave/leave-question.service";

export async function POST(
  request: Request,
  routeContext: { params: Promise<{ id: string; questionId: string }> },
) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.STUDENT,
    ]);

    const { id: leaveId, questionId } = await routeContext.params;

    const body = await request.json();
    const dto = answerLeaveQuestionSchema.parse(body);

    const result = await answerQuestion(leaveId, questionId, dto, currentUser);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
