"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";

type ApprovalState =
  | "loading"
  | "invalid"
  | "enter-phone"
  | "enter-otp"
  | "verified"
  | "done";

type LeaveData = {
  approvalId: string;
  leaveRequestId: string;
  studentName: string;
  studentRollNumber: string;
  leaveReason: string;
  leaveStartDate: string;
  leaveEndDate: string;
  submittedForm: Record<string, unknown> | null;
};

export function ParentApprovalFlow({ token }: { token: string }) {
  const [state, setState] = useState<ApprovalState>("loading");
  const [error, setError] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [otp, setOtp] = useState<string>("");
  const [phoneLast4, setPhoneLast4] = useState<string>("");
  const [leaveData, setLeaveData] = useState<LeaveData | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [decision, setDecision] = useState<string>("");
  const [comments, setComments] = useState<string>("");

  const handleSendOtp = async () => {
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(
        `/api/parent-approve/${token}/send-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        }
      );

      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || "Failed to send OTP");
        return;
      }

      setPhoneLast4(data.data.phoneLast4);
      setState("enter-otp");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(
        `/api/parent-approve/${token}/verify-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ otp }),
        }
      );

      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || "Invalid OTP");
        return;
      }

      setLeaveData(data.data);
      setState("verified");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

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

      setState("done");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (state === "loading") {
      setState("enter-phone");
    }
  }, [state]);

  if (state === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-red-500 text-5xl mb-4">X</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Invalid Link
          </h1>
          <p className="text-gray-600">
            This approval link is invalid or has expired.
            Please contact the hostel administration.
          </p>
        </div>
      </div>
    );
  }

  if (state === "enter-phone") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Parent Leave Approval
          </h1>
          <p className="text-gray-600 mb-6">
            Enter the phone number registered with your
            ward to receive an OTP.
          </p>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9492079771"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <Button
              onClick={handleSendOtp}
              disabled={!/^(\+91)?\d{10}$/.test(phone.replace(/\s/g, "")) || submitting}
              className="w-full"
            >
              {submitting ? "Sending..." : "Send OTP"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (state === "enter-otp") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Enter OTP
          </h1>
          <p className="text-gray-600 mb-6">
            Enter the 6-digit OTP sent to ****{phoneLast4}
          </p>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                OTP Code
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit code"
                maxLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg tracking-widest"
              />
            </div>

            <Button
              onClick={handleVerifyOtp}
              disabled={otp.length !== 6 || submitting}
              className="w-full"
            >
              {submitting ? "Verifying..." : "Verify OTP"}
            </Button>

            <button
              onClick={() => setState("enter-phone")}
              className="w-full text-sm text-blue-600 hover:underline"
            >
              Change phone number
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-green-500 text-5xl mb-4">
            Done
          </div>
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

  if (state === "verified" && leaveData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-lg w-full bg-white rounded-lg shadow-md p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-6">
            Leave Request Details
          </h1>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4 mb-6">
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">Student</span>
              <span className="font-medium">
                {leaveData.studentName}
              </span>
            </div>

            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">Roll Number</span>
              <span className="font-medium">
                {leaveData.studentRollNumber}
              </span>
            </div>

            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">Dates</span>
              <span className="font-medium">
                {new Date(
                  leaveData.leaveStartDate
                ).toLocaleDateString()}{" "}
                -{" "}
                {new Date(
                  leaveData.leaveEndDate
                ).toLocaleDateString()}
              </span>
            </div>

            <div className="border-b pb-2">
              <span className="text-gray-600 block mb-1">
                Reason
              </span>
              <p className="text-gray-900">
                {leaveData.leaveReason}
              </p>
            </div>

            {leaveData.submittedForm &&
              Object.keys(leaveData.submittedForm).length >
                0 && (
                <div className="border-b pb-2">
                  <span className="text-gray-600 block mb-2">
                    Submitted Form
                  </span>
                  <div className="bg-gray-50 rounded-md p-3 space-y-2">
                    {Object.entries(
                      leaveData.submittedForm
                    ).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-gray-600 capitalize">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </span>
                        <span className="text-gray-900">
                          {typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value)}
                        </span>
                      </div>
                    ))}
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

  return null;
}

export default ParentApprovalFlow;
