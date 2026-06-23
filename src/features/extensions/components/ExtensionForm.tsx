"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import createExtensionSchema from "@/dto/leave/create-extension.dto";
import type { CreateExtensionDto } from "@/dto/leave/create-extension.dto";
import { createExtension } from "@/lib/api/extension-api";

interface ExtensionFormProps {
  leaveId: string;
  currentEndAt: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ExtensionForm({ leaveId, currentEndAt, onSuccess, onCancel }: ExtensionFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateExtensionDto>({
    resolver: zodResolver(createExtensionSchema),
    defaultValues: {
      reason: "",
      requestedEndAt: "",
    },
  });

  const minEnd = currentEndAt ? toDatetimeLocal(new Date(currentEndAt)) : undefined;

  const onSubmit = async (data: CreateExtensionDto) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Convert datetime-local value to ISO string
      const payload = {
        ...data,
        requestedEndAt: new Date(data.requestedEndAt).toISOString(),
      };
      await createExtension(leaveId, payload);
      toast.success("Extension requested");
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create extension";
      toast.error(msg);
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">
          New End Date &amp; Time
        </label>
        <input
          type="datetime-local"
          {...register("requestedEndAt")}
          min={minEnd}
          className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {errors.requestedEndAt && (
          <p className="mt-1 text-xs text-destructive">{errors.requestedEndAt.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Reason for Extension</label>
        <textarea
          {...register("reason")}
          rows={3}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Why do you need an extension?"
        />
        {errors.reason && (
          <p className="mt-1 text-xs text-destructive">{errors.reason.message}</p>
        )}
      </div>

      {submitError && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {submitError}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Extension"}
        </Button>
      </div>
    </form>
  );
}
