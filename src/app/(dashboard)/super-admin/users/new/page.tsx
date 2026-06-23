"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { UserForm, type UserFormData } from "@/components/shared/UserForm";
import { Button } from "@/components/ui/button";

export default function NewUserPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: UserFormData) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? "Failed to create user");
      }
      router.push(`/super-admin/users/${json.data.id}`);
    } catch (err) {
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Create User"
        description="Add a new user to the system."
        action={
          <Button variant="outline" onClick={() => router.push("/super-admin/users")}>
            Back
          </Button>
        }
      />

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <UserForm
          mode="create"
          onSubmit={handleSubmit}
          onCancel={() => router.push("/super-admin/users")}
          isLoading={isSubmitting}
        />
      </div>
    </div>
  );
}
