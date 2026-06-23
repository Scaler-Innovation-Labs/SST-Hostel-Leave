import { ParentApprovalFlow } from "@/components/parent/ParentApprovalFlow";

export default async function ParentApprovePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <ParentApprovalFlow token={token} />;
}
