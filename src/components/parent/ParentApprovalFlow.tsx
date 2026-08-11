"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";

type LeaveData = {
  approvalId: string;
  targetType: "LEAVE_REQUEST" | "LEAVE_EXTENSION";
  leaveRequestId: string;
  leaveExtensionId: string | null;
  extensionNumber: number | null;
  studentName: string;
  studentRollNumber: string;
  leaveReason: string;
  leaveStartDate: string;
  leaveEndDate: string;
  submittedForm: Record<string, unknown> | null;
  parentName: string;
  parentPhone: string;
};

type Props = {
  token: string;
  leaveData: LeaveData;
};

export function ParentApprovalFlow({ token, leaveData }: Props) {
  const [error, setError] = useState<string>("");
  const [decision, setDecision] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [comments, setComments] = useState<string>("");

  const isExtension = leaveData.targetType === "LEAVE_EXTENSION";

  const handleDecision = async (dec: string) => {
    setDecision(dec);
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(
        `/api/parent-approve/${token}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: dec,
            comments: comments || undefined,
          }),
        }
      );

      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || "Failed to submit decision");
        return;
      }

      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-green-500 text-5xl mb-4">Done</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Response Recorded
          </h1>
          <p className="text-gray-600">
            Your response has been recorded. Thank you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-lg w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">
          {isExtension ? "Leave Extension Request" : "Leave Request Details"}
        </h1>
        {isExtension && (
          <p className="text-sm text-gray-500 mb-6">
            Extension #{leaveData.extensionNumber}
          </p>
        )}
        {!isExtension && <div className="mb-6" />}

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4 mb-6">
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Student</span>
            <span className="font-medium">{leaveData.studentName}</span>
          </div>

          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Roll Number</span>
            <span className="font-medium">{leaveData.studentRollNumber}</span>
          </div>

          {isExtension ? (
            <>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-600">Current End Date</span>
                <span className="font-medium">
                  {new Date(leaveData.leaveStartDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-600">Requested New End Date</span>
                <span className="font-medium">
                  {new Date(leaveData.leaveEndDate).toLocaleDateString()}
                </span>
              </div>
            </>
          ) : (
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">Dates</span>
              <span className="font-medium">
                {new Date(leaveData.leaveStartDate).toLocaleDateString()} -{" "}
                {new Date(leaveData.leaveEndDate).toLocaleDateString()}
              </span>
            </div>
          )}

          <div className="border-b pb-2">
            <span className="text-gray-600 block mb-1">
              {isExtension ? "Extension Reason" : "Reason"}
            </span>
            <p className="text-gray-900">{leaveData.leaveReason}</p>
          </div>

          {leaveData.submittedForm &&
            Object.keys(leaveData.submittedForm).length > 0 && (
              <div className="border-b pb-2">
                <span className="text-gray-600 block mb-2">
                  Submitted Form
                </span>
                <div className="bg-gray-50 rounded-md p-3 space-y-2">
                  {Object.entries(leaveData.submittedForm).map(
                    ([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-600 capitalize">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </span>
                        <span className="text-gray-900">
                          {typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value)}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Comments (optional)
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Add any comments..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-4">
          <Button
            onClick={() => handleDecision(LEAVE_APPROVAL_DECISION.APPROVED)}
            disabled={submitting}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {submitting && decision === LEAVE_APPROVAL_DECISION.APPROVED
              ? "Submitting..."
              : "Approve"}
          </Button>

          <Button
            onClick={() => handleDecision(LEAVE_APPROVAL_DECISION.REJECTED)}
            disabled={submitting}
            className="flex-1 bg-red-600 hover:bg-red-700"
          >
            {submitting && decision === LEAVE_APPROVAL_DECISION.REJECTED
              ? "Submitting..."
              : "Reject"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ParentApprovalFlow;
