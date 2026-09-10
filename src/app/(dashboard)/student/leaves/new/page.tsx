"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, FileText, Info, Upload, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";

import { ROUTES } from "@/constants/routes";
import {
  Button,
  ConfirmDialog,
  ErrorState,
  Field,
  fieldControlProps,
  Masthead,
  Refusal,
  SectionCard,
  Select,
  Skeleton,
  TECH_LABEL,
  Textarea,
} from "@/design-system/sst";
import type { CreateLeaveDto } from "@/dto/leave/create-leave.dto";
import type { CreateLeaveFormDto } from "@/dto/leave/create-leave-form.dto";
import { createLeaveFormSchema } from "@/dto/leave/create-leave-form.dto";
import { DynamicLeaveFields } from "@/features/leaves/components/DynamicLeaveFields";
import {
  type LeaveTypeOption as LeaveTypeItem,
  useLeaveTypes,
} from "@/features/leaves/hooks/use-leaves";
import { fetcher } from "@/lib/api/fetcher";
import { createLeave, uploadLeaveDocument } from "@/lib/api/leave-api";
import { formatDateRange } from "@/lib/date-utils";
import { parseLeaveFormSchema } from "@/lib/leave-form-schema";

const REASON_LIMIT = 1000;
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
const DOCUMENT_ACCEPT = ".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx";
const ALLOWED_DOCUMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

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
  const {
    leaveTypes,
    isLoading: typesLoading,
    isError: typesError,
  } = useLeaveTypes();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPocNotice, setShowPocNotice] = useState(false);
  const [previousWasLateStay, setPreviousWasLateStay] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<Record<string, File>>({});

  const {
    register,
    handleSubmit,
    control,
    unregister,
    formState: { errors },
  } = useForm<CreateLeaveFormDto>({
    resolver: zodResolver(createLeaveFormSchema),
    defaultValues: { reason: "", startAt: "", endAt: "" },
  });

  const startAt = useWatch({ control, name: "startAt" });
  const endAt = useWatch({ control, name: "endAt" });
  const reason = useWatch({ control, name: "reason" });
  const selectedLeaveTypeId = useWatch({ control, name: "leaveTypeId" });

  const selectedLeaveType = leaveTypes.find(
    (type: LeaveTypeItem) => type.id === selectedLeaveTypeId
  );
  const typeDescription = selectedLeaveType?.description ?? undefined;
  const needsPoc = selectedLeaveType?.requiresPoc ?? false;
  const dynamicSchema = parseLeaveFormSchema(selectedLeaveType?.formSchema);
  const configuredDocuments = selectedLeaveType?.requiredDocuments;
  const requiredDocuments = Array.isArray(configuredDocuments)
    ? configuredDocuments
    : (configuredDocuments?.documents ?? []);

  const { data: pocData, isLoading: pocLoading } = useSWR<PocUser[]>(
    needsPoc ? "/api/v1/users/pocs" : null,
    fetcher
  );
  const pocUsers = pocData ?? [];

  // A late stay must be cleared with the POC in person before it is submitted,
  // so the reminder fires the moment that type is chosen.
  const isLateStay = selectedLeaveType?.code === "LATE_STAY_COLLEGE";
  if (previousWasLateStay !== isLateStay) {
    setPreviousWasLateStay(isLateStay);
    setShowPocNotice(isLateStay);
  }

  useEffect(() => {
    unregister("submittedForm");
  }, [selectedLeaveTypeId, unregister]);

  const showPeriod = startAt && endAt && new Date(startAt) < new Date(endAt);

  async function onSubmit(data: CreateLeaveFormDto) {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const missingRequiredDocument = requiredDocuments.find(
        (document) => document.required && !selectedDocuments[document.code],
      );
      if (missingRequiredDocument) {
        throw new Error(`Upload the required document: ${missingRequiredDocument.label}`);
      }

      if (needsPoc && !data.pocId) {
        throw new Error(
          "This leave type needs a point of contact. Pick the staff member who has agreed to be yours."
        );
      }

      const payload: CreateLeaveDto = {
        ...data,
        startAt: new Date(data.startAt).toISOString(),
        endAt: new Date(data.endAt).toISOString(),
      };

      const result = (await createLeave(payload)) as { id?: string };

      if (result.id) {
        await Promise.all(
          Object.entries(selectedDocuments).map(([documentType, file]) =>
            uploadLeaveDocument(result.id!, file, documentType),
          ),
        );
      }

      toast.success("Leave request submitted");
      router.push(
        result?.id ? `${ROUTES.STUDENT_LEAVES}/${result.id}` : ROUTES.STUDENT_LEAVES
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We couldn't submit your request";
      toast.error(message);
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (typesLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (typesError) {
    return (
      <ErrorState
        title="We couldn't load the leave types"
        description="Without them there's nothing to choose from. Try again in a moment."
        onRetry={() => router.refresh()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Masthead
        eyebrow="Student"
        title="Request leave"
        description={
          typeDescription ??
          "Tell us when you're going and why. Your request goes to whoever has to approve this kind of leave."
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <SectionCard Icon={FileText} title="The request">
          <div className="space-y-5">
            <Field
              htmlFor="leaveTypeId"
              label="Leave type"
              required
              hint={typeDescription}
              error={errors.leaveTypeId?.message}
            >
              <Select
                {...register("leaveTypeId")}
                {...fieldControlProps("leaveTypeId", {
                  hint: typeDescription,
                  error: errors.leaveTypeId?.message,
                })}
              >
                <option value="">Choose a leave type…</option>
                {leaveTypes.map((type: LeaveTypeItem) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              htmlFor="reason"
              label="Reason"
              required
              error={errors.reason?.message}
            >
              <Textarea
                rows={4}
                placeholder="Where you're going and why."
                {...register("reason")}
                {...fieldControlProps("reason", {
                  error: errors.reason?.message,
                })}
              />
              <p className="text-right text-caption tabular-nums text-muted">
                {(reason ?? "").length} / {REASON_LIMIT}
              </p>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                htmlFor="startAt"
                label="Leaving"
                required
                error={errors.startAt?.message}
              >
                <input
                  type="datetime-local"
                  className="h-10 w-full rounded-md border border-border bg-surface-sunken px-3 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  {...register("startAt")}
                  {...fieldControlProps("startAt", {
                    error: errors.startAt?.message,
                  })}
                />
              </Field>

              <Field
                htmlFor="endAt"
                label="Returning"
                required
                error={errors.endAt?.message}
              >
                <input
                  type="datetime-local"
                  min={startAt ? toDatetimeLocal(new Date(startAt)) : undefined}
                  className="h-10 w-full rounded-md border border-border bg-surface-sunken px-3 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  {...register("endAt")}
                  {...fieldControlProps("endAt", {
                    error: errors.endAt?.message,
                  })}
                />
              </Field>
            </div>

            {showPeriod && (
              <div className="rounded-lg border border-border bg-surface-sunken px-3 py-2">
                <p className={TECH_LABEL}>You&apos;ll be away</p>
                <p className="mt-0.5 text-body font-medium text-ink">
                  {formatDateRange(startAt, endAt)}
                </p>
              </div>
            )}

            {requiredDocuments.length > 0 && (
              <div className="space-y-3 rounded-lg border border-border bg-surface-sunken p-4">
                <div>
                  <p className="text-body font-medium text-ink">Documents</p>
                  <p className="mt-1 text-caption text-muted">
                    Add the documents configured for this leave type. They will be uploaded with your request.
                  </p>
                </div>
                {requiredDocuments.map((document) => {
                  const selectedFile = selectedDocuments[document.code];
                  return (
                    <label key={document.code} className="block rounded-md border border-border bg-surface p-3">
                      <span className="flex items-center gap-2 text-body font-medium text-ink">
                        <Upload className="h-4 w-4 text-accent" aria-hidden />
                        {document.label}
                        {document.required && <span className="text-danger">*</span>}
                      </span>
                      <span className="mt-1 block text-caption text-muted">
                        {selectedFile ? selectedFile.name : "Choose a JPG, PNG, GIF, PDF, DOC, or DOCX file (max 10MB)."}
                      </span>
                      <input
                        type="file"
                        accept={DOCUMENT_ACCEPT}
                        className="mt-3 block w-full text-caption text-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-caption file:font-medium file:text-white"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          if (file.size > MAX_DOCUMENT_SIZE) {
                            setSubmitError(`${document.label} must be smaller than 10MB.`);
                            event.target.value = "";
                            return;
                          }
                          if (!ALLOWED_DOCUMENT_TYPES.has(file.type)) {
                            setSubmitError(`${document.label} must be a JPG, PNG, GIF, PDF, DOC, or DOCX file.`);
                            event.target.value = "";
                            return;
                          }
                          setSubmitError(null);
                          setSelectedDocuments((current) => ({
                            ...current,
                            [document.code]: file,
                          }));
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </SectionCard>

        {/* Asked for only once a type that needs them is chosen. */}
        {dynamicSchema.fields.length > 0 && (
          <SectionCard
            Icon={Info}
            title="Extra details"
            meta={`Required for ${selectedLeaveType?.name ?? "this type"}`}
          >
            <DynamicLeaveFields schema={dynamicSchema} register={register} />
          </SectionCard>
        )}

        {needsPoc && (
          <SectionCard Icon={UserCheck} title="Point of contact">
            <Field
              htmlFor="pocId"
              label="Who is your point of contact?"
              required
              hint="They're notified about this leave and may need to approve it."
              error={errors.pocId?.message}
            >
              <Select
                disabled={pocLoading}
                {...register("pocId")}
                {...fieldControlProps("pocId", {
                  hint: "They're notified about this leave and may need to approve it.",
                  error: errors.pocId?.message,
                })}
              >
                <option value="">
                  {pocLoading ? "Loading staff…" : "Choose a point of contact…"}
                </option>
                {pocUsers.map((poc) => (
                  <option key={poc.id} value={poc.id}>
                    {poc.fullName}
                    {poc.email ? ` — ${poc.email}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </SectionCard>
        )}

        {submitError && (
          <Refusal
            what="We couldn't submit your request"
            why={submitError}
            whatNow="Check the fields above and try again. Nothing has been saved yet."
          />
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Discard
          </Button>
          <Button
            type="submit"
            loading={submitting}
            loadingText="Submitting…"
            trailingArrow
          >
            <CalendarPlus className="h-4 w-4" aria-hidden />
            Submit request
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={showPocNotice}
        onOpenChange={setShowPocNotice}
        title="Clear this with your POC first"
        consequence="A late stay needs your point of contact's agreement before you submit. Submitting without it will get the request rejected."
        confirmLabel="I've got permission"
        dismissLabel="Pick another type"
        destructive={false}
        onConfirm={() => setShowPocNotice(false)}
      />
    </div>
  );
}
