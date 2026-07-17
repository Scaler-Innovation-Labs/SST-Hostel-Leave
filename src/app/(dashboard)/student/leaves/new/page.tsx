"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import type { CreateLeaveDto } from "@/dto/leave/create-leave.dto";
import type { CreateLeaveFormDto } from "@/dto/leave/create-leave-form.dto";
import { createLeaveFormSchema } from "@/dto/leave/create-leave-form.dto";
import { DynamicLeaveFields } from "@/features/leaves/components/DynamicLeaveFields";
import { useLeaveTypes } from "@/features/leaves/hooks/use-leaves";
import { createLeave } from "@/lib/api/leave-api";
import { parseLeaveFormSchema } from "@/lib/leave-form-schema";

type LeaveTypeItem = {
  id: string;
  code: string;
  name: string;
  category: string;
  requiresPoc?: boolean;
  formSchema?: { fields: Array<Record<string, unknown>> };
};

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type PocUser = {
  id: string;
  fullName: string;
  email: string | null;
};

export default function NewLeavePage() {
  const router = useRouter();
  const { leaveTypes, isLoading: typesLoading, isError: typesError } = useLeaveTypes();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pocUsers, setPocUsers] = useState<PocUser[]>([]);
  const [pocLoading, setPocLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    unregister,
    formState: { errors },
  } = useForm<CreateLeaveFormDto>({
    resolver: zodResolver(createLeaveFormSchema),
    defaultValues: {
      reason: "",
      startAt: "",
      endAt: "",
    },
  });

  const startAt = watch("startAt");
  const selectedLeaveTypeId = watch("leaveTypeId");
  const selectedLeaveType = leaveTypes.find(
    (leaveType: LeaveTypeItem) => leaveType.id === selectedLeaveTypeId,
  );
  const needsPoc = (selectedLeaveType as LeaveTypeItem | undefined)?.requiresPoc ?? false;
  const dynamicSchema = parseLeaveFormSchema(selectedLeaveType?.formSchema);

  useEffect(() => {
    unregister("submittedForm");
  }, [selectedLeaveTypeId, unregister]);

  useEffect(() => {
    if (needsPoc && pocUsers.length === 0) {
      setPocLoading(true);
      fetch("/api/v1/users/pocs")
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setPocUsers(data.data ?? []);
        })
        .catch(() => {})
        .finally(() => setPocLoading(false));
    }
  }, [needsPoc, pocUsers.length]);

  if (typesLoading) return <LoadingState count={3} />;
  if (typesError) return <ErrorState message="Failed to load leave types" />;

  const onSubmit = async (data: CreateLeaveFormDto) => {
  setSubmitting(true);
  setSubmitError(null);

  try {
    if (needsPoc && !data.pocId) {
      throw new Error("Please select a Point of Contact (POC) for this leave type");
    }

    const payload: CreateLeaveDto = {
      ...data,

      startAt: new Date(data.startAt).toISOString(),

      endAt: new Date(data.endAt).toISOString(),
    };

    const result = await createLeave(payload) as { id?: string };

    toast.success("Leave request submitted");
    if (result?.id) {
      router.push(`/student/leaves/${result.id}`);
    } else {
      router.push(ROUTES.STUDENT_LEAVES);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create leave";
    toast.error(message);
    setSubmitError(message);
  } finally {
    setSubmitting(false);
  }
};

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New Leave Request"
        description="Submit a new hostel leave request."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold">Leave Details</h3>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Leave Type</label>
              <select
                {...register("leaveTypeId")}
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select leave type...</option>
                {leaveTypes.map((lt: LeaveTypeItem) => (
                  <option key={lt.id} value={lt.id}>
                    {lt.name}
                  </option>
                ))}
              </select>
              {errors.leaveTypeId && (
                <p className="mt-1 text-xs text-destructive">{errors.leaveTypeId.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Reason</label>
              <textarea
                {...register("reason")}
                rows={4}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Describe the reason for your leave..."
              />
              {errors.reason && (
                <p className="mt-1 text-xs text-destructive">{errors.reason.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Start Date & Time</label>
                <input
                  type="datetime-local"
                  {...register("startAt")}
                  className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {errors.startAt && (
                  <p className="mt-1 text-xs text-destructive">{errors.startAt.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">End Date & Time</label>
                <input
                  type="datetime-local"
                  {...register("endAt")}
                  min={startAt ? toDatetimeLocal(new Date(startAt)) : undefined}
                  className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {errors.endAt && (
                  <p className="mt-1 text-xs text-destructive">{errors.endAt.message}</p>
                )}
              </div>
            </div>

          </div>
        </div>

        <DynamicLeaveFields schema={dynamicSchema} register={register} />

        {needsPoc && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-4 text-base font-semibold">Point of Contact</h3>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Select POC <span className="text-destructive">*</span>
              </label>
              <select
                {...register("pocId")}
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">
                  {pocLoading ? "Loading POCs..." : "Select a POC..."}
                </option>
                {pocUsers.map((poc) => (
                  <option key={poc.id} value={poc.id}>
                    {poc.fullName}{poc.email ? ` (${poc.email})` : ""}
                  </option>
                ))}
              </select>
              {errors.pocId && (
                <p className="mt-1 text-xs text-destructive">{errors.pocId.message}</p>
              )}
            </div>
          </div>
        )}

        {submitError && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {submitError}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Leave Request"}
          </Button>
        </div>
      </form>
    </div>
  );
}
