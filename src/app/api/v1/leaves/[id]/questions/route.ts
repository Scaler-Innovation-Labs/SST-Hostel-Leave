import createLeaveQuestionSchema from "@/dto/leave/create-leave-question.dto";
import listLeaveQuestionsSchema from "@/dto/leave/list-leave-questions.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { askQuestion, listQuestions } from "@/services/leave/leave-question.service";

export async function GET(
  request: Request,
  routeContext: { params: Promise<{ id: string }> },
) {
  try {
    requireAnyRole(await requireAuth(), [
      ROLES.STUDENT,
      ROLES.POC,
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);

    const { id: leaveId } = await routeContext.params;

    const url = new URL(request.url);
    const query = listLeaveQuestionsSchema.parse({
      page: url.searchParams.get("page"),
      limit: url.searchParams.get("limit"),
    });

    const result = await listQuestions(leaveId, query);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function POST(
  request: Request,
  routeContext: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.POC,
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);

    const { id: leaveId } = await routeContext.params;

    const body = await request.json();
    const dto = createLeaveQuestionSchema.parse(body);

    const result = await askQuestion(leaveId, dto, currentUser);

    return ApiResponse.created(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
