import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  console.log("Connecting to DB...");
  const { leaveApprovalRepository } = await import("@/db/repositories/leave/leave-approval.repository");

  const result = await leaveApprovalRepository.findExtensionApprovals({
    page: 1,
    limit: 5,
  });

  console.log(`total=${result.total} totalPages=${result.totalPages} stats=${JSON.stringify(result.stats)}`);
  for (const item of result.items) {
    console.log("---");
    console.log(
      JSON.stringify(
        {
          id: item.id,
          decision: item.decision,
          stepKey: item.stepKey,
          studentName: item.studentName,
          roll: item.studentRollNumber,
          hostel: item.hostelName,
          dept: item.departmentName,
          room: item.roomNumber,
          leaveType: item.leaveTypeName,
          parent: item.parentName,
          parentPhone: item.parentPhone,
          leaveExtId: item.leaveExtensionId,
          leaveReq: item.leaveRequest && {
            status: item.leaveRequest.status,
            requestNumber: item.leaveRequest.requestNumber,
            currentStepKey: item.leaveRequest.currentStepKey,
            currentStepOrder: item.leaveRequest.currentStepOrder,
            startAt: item.leaveRequest.startAt,
            endAt: item.leaveRequest.endAt,
            hasForm: !!item.leaveRequest.submittedForm,
            hasPolicy: !!item.leaveRequest.policyResult,
          },
          workflowSteps: item.workflowSteps?.map((s) => `${s.stepOrder}:${s.stepKey}`),
        },
        null,
        1
      )
    );
  }

  // Scoped variant: hostel UNI-1
  const scoped = await leaveApprovalRepository.findExtensionApprovals({
    hostelIds: undefined,
    page: 1,
    limit: 3,
    status: "PENDING",
    waitingOn: "ADMIN_APPROVAL",
  });
  console.log("\npending+waitingOn=ADMIN_APPROVAL total:", scoped.total, "first:", scoped.items[0]?.leaveRequest?.requestNumber);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
