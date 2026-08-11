import Link from "next/link";

import { ParentApprovalFlow } from "@/components/parent/ParentApprovalFlow";
import { getLeaveDetailsByToken } from "@/services/parent/get-leave-details-by-token.service";

export default async function ParentApprovePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let leaveData;
  let errorMessage: string | null = null;

  try {
    leaveData = await getLeaveDetailsByToken(token);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Invalid or expired link";
  }

  if (errorMessage || !leaveData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-red-500 text-5xl mb-4">X</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Invalid Link
          </h1>
          <p className="text-gray-600 mb-6">
            {errorMessage ?? "Invalid or expired link"}
          </p>
          <Link
            href="/"
            className="text-blue-600 hover:underline text-sm"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  return <ParentApprovalFlow token={token} leaveData={leaveData} />;
}