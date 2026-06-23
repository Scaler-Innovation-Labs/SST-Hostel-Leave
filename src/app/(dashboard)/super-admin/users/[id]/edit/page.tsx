"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { UserForm } from "@/components/shared/UserForm";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-users";

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user, isLoading, isError, error, mutate } = useUser(id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (isLoading) return <LoadingState count={3} />;
  if (isError) return <ErrorState message={error?.message ?? "Failed to load user"} onRetry={() => mutate()} />;
  if (!user) return <ErrorState message="User not found" />;

  const handleSubmit = async (data: {
    fullName: string;
    email: string;
    phone: string;
    gender: string;
    hostelId: string;
    roleCodes: string[];
    isActive: boolean;
  }) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/v1/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: data.fullName,
          email: data.email || undefined,
          phone: data.phone || undefined,
          gender: data.gender || undefined,
          isActive: data.isActive,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? "Failed to update user");
      }
      await mutate();
      router.push(`/super-admin/users/${id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={`Edit: ${user.fullName}`}
        description="Update user profile details."
        action={
          <Button variant="outline" onClick={() => router.push(`/super-admin/users/${id}`)}>
            Cancel
          </Button>
        }
      />

      {submitError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {submitError}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <UserForm
          mode="edit"
          initialData={{
            fullName: user.fullName,
            email: user.email,
            gender: "",
            isActive: user.isActive,
            roleCodes: user.userRoles?.map((r) => r.roleCode) ?? [],
          }}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/super-admin/users/${id}`)}
          isLoading={isSubmitting}
        />
      </div>
    </div>
  );
}
