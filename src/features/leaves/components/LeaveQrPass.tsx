"use client";

import { Check, Clock, QrCode, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { QrCodeDisplay } from "@/components/qr/QrCodeDisplay";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { QR_STATUS } from "@/constants/movement/qr-status";
import { Button, Refusal, TECH_LABEL } from "@/design-system/sst";
import { QrPassDialog } from "@/features/dashboard/components/QrPassDialog";
import { useQrPasses } from "@/hooks/use-qr-passes";
import { useQrToken } from "@/hooks/use-qr-token";
import { generateQr } from "@/lib/api/movement-api";
import { formatDateTime } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

/** A scan that has either happened, with its time, or has not yet. */
function ScanRow({ label, at }: { label: string; at: string | null }) {
  return (
    <>
      <dt className="text-caption text-muted">{label}</dt>
      <dd
        className={cn(
          "inline-flex items-center gap-1 text-caption font-medium",
          at ? "text-success" : "text-muted"
        )}
      >
        {at ? (
          <>
            <Check className="h-3 w-3 shrink-0" aria-hidden />
            {formatDateTime(at)}
          </>
        ) : (
          <>
            <Clock className="h-3 w-3 shrink-0" aria-hidden />
            Not yet
          </>
        )}
      </dd>
    </>
  );
}

/**
 * The gate pass for this leave.
 *
 * A pass is authorization, not history: one token per leave, served by the
 * API. Generating never destroys a working pass — the service is idempotent
 * for an active one and only re-issues a broken pass, so the emailed QR and
 * the one here stay the same code.
 */
export function LeaveQrPass({ leaveId }: { leaveId: string }) {
  const [generating, setGenerating] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [passOpen, setPassOpen] = useState(false);
  const { qrPasses, mutate } = useQrPasses(leaveId);
  const { storeToken, getToken } = useQrToken();

  const activePass = qrPasses.find((pass) => pass.status === QR_STATUS.ACTIVE);
  const latestPass = qrPasses[0] ?? null;
  const token = activePass
    ? (activePass.token ?? getToken(activePass.id) ?? null)
    : null;
  // sessionStorage is only a fallback for passes issued before raw tokens
  // were stored server-side.
  const needsRepair = Boolean(activePass && !token);

  async function handleGenerate() {
    if (!leaveId) return;
    setGenerating(true);
    setFailure(null);
    try {
      const result = (await generateQr(leaveId, "LEAVE_EXIT")) as {
        passId: string;
        token: string;
      } | null;
      if (result?.passId && result?.token) {
        storeToken(result.passId, result.token, leaveId);
        toast.success("Gate pass ready");
      } else if (result?.passId) {
        toast.success("Gate pass is already active");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The pass didn't load";
      toast.error(message);
      setFailure(message);
    } finally {
      setGenerating(false);
      mutate();
    }
  }

  const spentPass =
    latestPass && !activePass
      ? {
          [QR_STATUS.USED]: {
            label: "Gate pass used",
            detail: "You've completed this leave and returned to the hostel.",
          },
          [QR_STATUS.EXPIRED]: {
            label: "Gate pass expired",
            detail: latestPass.expiresAt
              ? `It expired on ${formatDateTime(latestPass.expiresAt)}.`
              : "This pass is no longer valid.",
          },
          [QR_STATUS.INVALIDATED]: {
            label: "Gate pass invalidated",
            detail: latestPass.invalidatedAt
              ? `It was invalidated on ${formatDateTime(latestPass.invalidatedAt)}.`
              : "This pass was invalidated by staff.",
          },
        }[latestPass.status as string]
      : null;

  return (
    <CollapsibleSection
      title="Gate pass"
      icon={QrCode}
      defaultOpen={Boolean(activePass || latestPass)}
    >
      {activePass && token ? (
        <>
          <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface-sunken p-4 sm:flex-row sm:items-start">
            <button
              type="button"
              onClick={() => setPassOpen(true)}
              aria-label="Show the gate pass full screen"
              className={cn(
                "shrink-0 rounded-xl bg-white p-2",
                "transition-transform duration-fast ease-standard active:translate-y-px",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              )}
            >
              <QrCodeDisplay token={token} size={160} />
            </button>

            <div className="min-w-0 flex-1">
              <p className={TECH_LABEL}>Active pass</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2">
                <dt className="text-caption text-muted">Expires</dt>
                <dd className="text-caption font-medium text-ink">
                  {activePass.expiresAt
                    ? formatDateTime(activePass.expiresAt)
                    : "—"}
                </dd>
                <ScanRow
                  label="Exit scan"
                  at={activePass.firstScanAt ?? null}
                />
                <ScanRow label="Return scan" at={activePass.closedAt ?? null} />
              </dl>
              <p className="mt-3 text-caption text-muted">
                Tap the code to show it full screen at the gate.
              </p>
            </div>
          </div>

          <QrPassDialog
            open={passOpen}
            onOpenChange={setPassOpen}
            token={token}
            validFor={
              activePass.expiresAt
                ? `Valid until ${formatDateTime(activePass.expiresAt)}.`
                : undefined
            }
          />
        </>
      ) : needsRepair ? (
        <Refusal
          what="This pass was issued before codes were stored on the server"
          why="It's still valid — the code just isn't cached on this device."
          whatNow="Fetch it once and the same pass stays good for this leave."
          action={
            <Button
              size="sm"
              onClick={handleGenerate}
              loading={generating}
              loadingText="Fetching…"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Show gate pass
            </Button>
          }
        />
      ) : spentPass ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-sunken p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-muted ring-1 ring-inset ring-border">
            {latestPass?.status === QR_STATUS.USED ? (
              <Check className="h-4 w-4 text-success" aria-hidden />
            ) : (
              <Clock className="h-4 w-4" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-small font-medium text-ink">{spentPass.label}</p>
            <p className="text-caption text-muted">{spentPass.detail}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-dashed border-border p-4 text-center">
            <p className="text-body text-muted">
              No gate pass yet. Generate one when you&apos;re ready to leave —
              the guard scans it on the way out and again when you return.
            </p>
          </div>

          {failure && (
            <Refusal
              what="We couldn't issue the pass"
              why={failure}
              whatNow="Try again in a moment. If it keeps failing, ask the hostel office to issue one manually."
            />
          )}

          <Button
            block
            onClick={handleGenerate}
            loading={generating}
            loadingText="Generating…"
          >
            <QrCode className="h-4 w-4" aria-hidden />
            Generate gate pass
          </Button>
        </div>
      )}
    </CollapsibleSection>
  );
}
