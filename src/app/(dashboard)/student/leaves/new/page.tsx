"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import type { CreateLeaveDto } from "@/dto/leave/create-leave.dto";
import type { CreateLeaveFormDto } from "@/dto/leave/create-leave-form.dto";
import { createLeaveFormSchema } from "@/dto/leave/create-leave-form.dto";
import { DynamicLeaveFields } from "@/features/leaves/components/DynamicLeaveFields";
import { type LeaveTypeOption as LeaveTypeItem, useLeaveTypes } from "@/features/leaves/hooks/use-leaves";
import { fetcher } from "@/lib/api/fetcher";
import { createLeave } from "@/lib/api/leave-api";
import { formatDateRange } from "@/lib/date-utils";
import { parseLeaveFormSchema } from "@/lib/leave-form-schema";

type PocUser = {
  id: string;
  fullName: string;
  email: string | null;
};

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function NewLeavePage() {
  const router = useRouter();
  const { leaveTypes, isLoading: typesLoading, isError: typesError } = useLeaveTypes();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPocPermissionNotice, setShowPocPermissionNotice] = useState(false);
  const [prevIsLateStay, setPrevIsLateStay] = useState(false);

  const {
    register,
    handleSubmit,
    control,
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

  const startAt = useWatch({ control, name: "startAt" });
  const endAt = useWatch({ control, name: "endAt" });
  const reason = useWatch({ control, name: "reason" });
  const selectedLeaveTypeId = useWatch({ control, name: "leaveTypeId" });
  const selectedLeaveType = leaveTypes.find(
    (lt: LeaveTypeItem) => lt.id === selectedLeaveTypeId,
  );
  const needsPoc = (selectedLeaveType as LeaveTypeItem | undefined)?.requiresPoc ?? false;
  const dynamicSchema = parseLeaveFormSchema(selectedLeaveType?.formSchema);

  const pocKey = needsPoc ? "/api/v1/users/pocs" : null;
  const { data: pocData, isLoading: pocLoading } = useSWR<PocUser[]>(pocKey, fetcher);
  const pocUsers = pocData ?? [];

  // "Late Stay At College" requests must be verbally approved by the POC
  // before the student submits — remind them whenever this type is selected.
  const isLateStay = selectedLeaveType?.code === "LATE_STAY_COLLEGE";
  if (prevIsLateStay !== isLateStay) {
    setPrevIsLateStay(isLateStay);
    setShowPocPermissionNotice(isLateStay);
  }

  useEffect(() => {
    unregister("submittedForm");
  }, [selectedLeaveTypeId, unregister]);

  const canShowDatePreview = startAt && endAt && new Date(startAt) < new Date(endAt);

  if (typesLoading) return <LoadingState count={3} />;
  if (typesError) return <ErrorState message="Failed to load leave types" />;

  const description = selectedLeaveType?.description ?? "Submit a new hostel leave request.";

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
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Leave Request</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-base font-semibold">Leave Details</h2>
            <p className="mt-1 text-xs text-muted-foreground">Choose the type of leave and describe your reason.</p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Leave Type <span className="text-destructive">*</span></label>
              <select
                {...register("leaveTypeId")}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select leave type...</option>
                {leaveTypes.map((lt: LeaveTypeItem) => (
                  <option key={lt.id} value={lt.id}>
                    {lt.name}
                  </option>
                ))}
              </select>
              {selectedLeaveType?.description && (
                <p className="mt-1.5 text-xs text-muted-foreground">{selectedLeaveType.description}</p>
              )}
              {errors.leaveTypeId && (
                <p className="mt-1 text-xs text-destructive">{errors.leaveTypeId.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Reason <span className="text-destructive">*</span></label>
              <textarea
                {...register("reason")}
                rows={4}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Describe the reason for your leave..."
              />
              <div className="mt-1 flex items-center justify-between">
                {errors.reason ? (
                  <p className="text-xs text-destructive">{errors.reason.message}</p>
                ) : <span />}
                <span className="text-xs text-muted-foreground">{(reason ?? "").length}/1000</span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Start Date & Time <span className="text-destructive">*</span></label>
                <input
                  type="datetime-local"
                  {...register("startAt")}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {errors.startAt && (
                  <p className="mt-1 text-xs text-destructive">{errors.startAt.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">End Date & Time <span className="text-destructive">*</span></label>
                <input
                  type="datetime-local"
                  {...register("endAt")}
                  min={startAt ? toDatetimeLocal(new Date(startAt)) : undefined}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {errors.endAt && (
                  <p className="mt-1 text-xs text-destructive">{errors.endAt.message}</p>
                )}
              </div>
            </div>

            {canShowDatePreview && (
              <div className="rounded-lg bg-muted px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  Leave period: <span className="font-medium text-foreground">{formatDateRange(startAt, endAt)}</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {dynamicSchema.fields.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-base font-semibold">Additional Information</h2>
              <p className="mt-1 text-xs text-muted-foreground">Extra details required for this leave type.</p>
            </div>
            <DynamicLeaveFields schema={dynamicSchema} register={register} />
          </div>
        )}

        {needsPoc && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-base font-semibold">Point of Contact <span className="text-destructive">*</span></h2>
              <p className="mt-1 text-xs text-muted-foreground">Select the POC who will be notified about your leave.</p>
            </div>
            <div>
              <select
                {...register("pocId")}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                disabled={pocLoading}
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
              {pocLoading && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading available POCs...
                </p>
              )}
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

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={submitting}
            className="sm:w-auto"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} className="gap-1.5 sm:w-auto">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Leave Request"
            )}
          </Button>
        </div>
      </form>

      <AlertDialog open={showPocPermissionNotice} onOpenChange={setShowPocPermissionNotice}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>POC Permission Required</AlertDialogTitle>
            <AlertDialogDescription>
              Please submit your request only after getting the permission from the POC.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowPocPermissionNotice(false)}>I understand</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
