"use client";

import { Check, Clock, QrCode, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { QrCodeDisplay } from "@/components/qr/QrCodeDisplay";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import type { QrMode } from "@/constants/leave/qr-mode";
import { QR_STATUS } from "@/constants/movement/qr-status";
import { Button, Refusal, TECH_LABEL } from "@/design-system/sst";
import { QrPassDialog } from "@/features/dashboard/components/QrPassDialog";
import { useQrCountdown } from "@/features/leaves/hooks/use-qr-countdown";
import { useQrPasses } from "@/hooks/use-qr-passes";
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
 * A pass is authorization, not history: one QR per leave, rendered
 * server-side from the encrypted credential — the exact same bytes as the
 * approval email. The raw token never reaches the browser.
 *
 * Display security: the QR code is displayed for 20 seconds at a time. After
 * 20 seconds, the credential is hidden until regenerated. Regenerating mints
 * a fresh server credential to prevent screenshot reuse while preserving scan state.
 */
export function LeaveQrPass({
  leaveId,
  qrMode,
}: {
  leaveId: string;
  qrMode?: QrMode;
}) {
  const [generating, setGenerating] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [passOpen, setPassOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const { qrPasses, mutate } = useQrPasses(leaveId);
  const { timeLeft, isExpired, resetCountdown, tokenVersion } = useQrCountdown();

  if (qrMode === "NONE") return null;

  const activePass = qrPasses.find((pass) => pass.status === QR_STATUS.ACTIVE);
  const latestPass = qrPasses[0] ?? null;
  const qrImageUrl = activePass
    ? `/api/v1/qr/${activePass.id}/image?v=${tokenVersion}`
    : null;
  // The pass exists but its QR could not be rendered — repairable once on
  // the server without invalidating anything.
  const needsRepair = Boolean(activePass && (!qrImageUrl || imageFailed));

  async function handleGenerate(regenerate = false) {
    if (!leaveId) return;
    setGenerating(true);
    setFailure(null);
    try {
      // Repair keeps the pass's own type: a RETURN_ONLY credential must not
      // be re-issued as an exit QR.
      const qrType: "LEAVE_EXIT" | "LEAVE_RETURN" =
        activePass?.qrType === "LEAVE_RETURN" || qrMode === "RETURN_ONLY"
          ? "LEAVE_RETURN"
          : "LEAVE_EXIT";
      const result = (await generateQr(leaveId, qrType, regenerate)) as {
        passId: string;
      } | null;
      if (result?.passId) {
        setImageFailed(false);
        resetCountdown();
        toast.success(regenerate ? "Gate pass regenerated" : "Gate pass ready");
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
      {activePass && qrImageUrl && !imageFailed ? (
        <>
          <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface-sunken p-4 sm:flex-row sm:items-start">
            {isExpired ? (
              <div className="flex h-[180px] w-[180px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface p-3 text-center">
                <RefreshCw className="h-5 w-5 text-accent" aria-hidden />
                <p className="text-caption font-semibold text-ink">
                  Pass hidden
                </p>
                <p className="text-micro text-muted">
                  Expired after 20s
                </p>
                <Button
                  size="sm"
                  onClick={() => handleGenerate(true)}
                  loading={generating}
                  loadingText="Generating…"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Regenerate
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
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
                  <QrCodeDisplay imageUrl={qrImageUrl} size={160} onError={() => setImageFailed(true)} />
                </button>
                <span className="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-micro font-medium text-ink">
                  <Clock className="h-3 w-3 text-accent" aria-hidden />
                  Valid for {timeLeft}s
                </span>
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className={TECH_LABEL}>
                  {qrMode === "DAILY_RECURRING" ? "Daily pass (1-2 scans/day)" : "Active pass"}
                </p>
                {!isExpired && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleGenerate(true)}
                    loading={generating}
                    disabled={generating}
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    Regenerate
                  </Button>
                )}
              </div>
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
                {isExpired
                  ? "Tap Regenerate before showing the code to the guard."
                  : qrMode === "DAILY_RECURRING"
                  ? "Accepts 1 or 2 scans per day throughout the approved period."
                  : "Tap the code to show it full screen at the gate."}
              </p>
            </div>
          </div>

          <QrPassDialog
            open={passOpen}
            onOpenChange={setPassOpen}
            imageUrl={qrImageUrl}
            validFor={
              activePass.expiresAt
                ? `Valid until ${formatDateTime(activePass.expiresAt)}.`
                : undefined
            }
            timeLeft={timeLeft}
            isExpired={isExpired}
            onRegenerate={() => handleGenerate(true)}
            regenerating={generating}
          />
        </>
      ) : needsRepair ? (
        <Refusal
          what="QR image unavailable"
          why="Your pass exists but its QR could not be rendered."
          whatNow="Repair it once on the server — the same QR stays valid for this leave."
          action={
            <Button
              size="sm"
              onClick={() => handleGenerate(false)}
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
            onClick={() => handleGenerate(false)}
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
