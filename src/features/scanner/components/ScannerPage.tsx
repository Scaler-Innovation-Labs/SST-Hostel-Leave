"use client";

import { format } from "date-fns";
import {
  Building2,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  QrCode,
  RotateCcw,
  User,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { QrScanner } from "@/components/qr/QrScanner";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, OfflineNotice } from "@/design-system/sst";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
  type QrScanPreviewResult,
  scanQr,
  scanQrPreview,
} from "@/lib/api/movement-api";
import { cn } from "@/lib/utils";

type ScanResult = {
  success: boolean;
  message: string;
  timestamp: Date;
  scanType?: "EXIT_SCAN" | "RETURN_SCAN";
};

function formatScanErrorMessage(reason: string): string {
  if (reason.toLowerCase().includes("qr token not found")) {
    return "QR token not found. Ask student to tap 'Regenerate' on their screen and show the live pass.";
  }
  return reason;
}

function formatLeaveWindow(leave: QrScanPreviewResult["leave"]): string {
  if (!leave) return "Leave details unavailable";
  const start = leave.startAt ? format(new Date(leave.startAt), "d MMM") : "?";
  const end = leave.endAt ? format(new Date(leave.endAt), "d MMM") : "?";
  return `${leave.typeName ?? "Leave"} · ${start} → ${end}`;
}

export function ScannerPage() {
  const online = useOnlineStatus();
  const [scanning, setScanning] = useState(false);
  const [currentResult, setCurrentResult] = useState<ScanResult | null>(null);
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);

  // Two-phase scan: decode -> preview -> guard confirms -> commit.
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [preview, setPreview] = useState<QrScanPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [autoResetSeconds, setAutoResetSeconds] = useState<number | null>(null);

  // Synchronous guards against duplicate frame processing & race conditions
  const isProcessingRef = useRef(false);
  const activeTokenRef = useRef<string | null>(null);
  const lastCommitted = useRef<{ token: string; at: number } | null>(null);

  const addResult = useCallback((result: ScanResult) => {
    setCurrentResult(result);
    setRecentScans((prev) => [result, ...prev].slice(0, 10));
    setAutoResetSeconds(result.success ? 4 : null);
  }, []);

  // Auto-reset timer after a successful scan so the guard does not have to tap every time
  useEffect(() => {
    if (!currentResult?.success) {
      return;
    }

    const timer = setInterval(() => {
      setAutoResetSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          setCurrentResult(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentResult]);

  const handleScanToken = useCallback(
    async (rawToken: string) => {
      const token = rawToken.trim();
      if (!token) return;

      // Synchronously block duplicate concurrent processing
      if (isProcessingRef.current) return;
      if (activeTokenRef.current === token) return;

      // Ignore re-scans of a QR that was just committed to
      if (
        lastCommitted.current &&
        lastCommitted.current.token === token &&
        Date.now() - lastCommitted.current.at < 5000
      ) {
        return;
      }

      isProcessingRef.current = true;
      activeTokenRef.current = token;

      setScanning(true);
      setCurrentResult(null);
      setPendingToken(token);
      setPreview(null);
      setPreviewLoading(true);

      try {
        const data = await scanQrPreview(token);
        if (!data.valid) {
          addResult({
            success: false,
            message: formatScanErrorMessage(data.reason ?? "QR is not scannable"),
            timestamp: new Date(),
            scanType: data.scanType ?? undefined,
          });
          setPendingToken(null);
          activeTokenRef.current = null;
        } else {
          setPreview(data);
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            try {
              navigator.vibrate(100);
            } catch {
              // Ignore if blocked
            }
          }
        }
      } catch (err) {
        addResult({
          success: false,
          message: err instanceof Error ? err.message : "Failed to verify QR",
          timestamp: new Date(),
        });
        setPendingToken(null);
        activeTokenRef.current = null;
      } finally {
        setPreviewLoading(false);
        setScanning(false);
        isProcessingRef.current = false;
      }
    },
    [addResult],
  );

  const handleCancelScan = useCallback(() => {
    isProcessingRef.current = false;
    activeTokenRef.current = null;
    setScanning(false);
    setPreviewLoading(false);
    setPendingToken(null);
    setPreview(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!pendingToken) return;
    setConfirming(true);
    try {
      const data = await scanQr(pendingToken);
      lastCommitted.current = { token: pendingToken, at: Date.now() };
      addResult({
        success: data.success,
        message: data.success
          ? "Scan successful"
          : formatScanErrorMessage(data.failureReason ?? "Scan failed"),
        timestamp: new Date(),
        scanType: data.scanType,
      });
      if (data.success && typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate([100, 50, 100]);
        } catch {
          // Ignore if blocked
        }
      }
    } catch (err) {
      addResult({
        success: false,
        message: err instanceof Error ? err.message : "Scan failed",
        timestamp: new Date(),
      });
    } finally {
      setConfirming(false);
      setPendingToken(null);
      setPreview(null);
      activeTokenRef.current = null;
      isProcessingRef.current = false;
    }
  }, [pendingToken, addResult]);

  const handleDiscard = useCallback(() => {
    isProcessingRef.current = false;
    activeTokenRef.current = null;
    setPendingToken(null);
    setPreview(null);
  }, []);

  const handleReset = useCallback(() => {
    isProcessingRef.current = false;
    activeTokenRef.current = null;
    setCurrentResult(null);
  }, []);


  const isExitScan = preview?.scanType === "EXIT_SCAN";
  const isCameraPaused =
    scanning || previewLoading || preview !== null || confirming;

  // Scan stats for today
  const todayScans = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return recentScans.filter((s) => s.timestamp >= today);
  }, [recentScans]);

  const todaySuccessCount = todayScans.filter((s) => s.success).length;
  const todayFailCount = todayScans.filter((s) => !s.success).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gate"
        title="Scan a pass"
        description="Point the camera at the student's code. Check the name and details before confirming."
        status={
          online
            ? { label: "Connected", tone: "success" }
            : { label: "No connection", tone: "danger" }
        }
      />

      <Button
        asChild
        variant="outline"
        size="lg"
        block
        className="h-12 w-full text-body font-medium sm:h-14 sm:text-body-lg"
      >
        <Link href="/guard/manual-movement">Manual check-in / check-out</Link>
      </Button>

      <div className="mx-auto max-w-2xl space-y-6">
        {!online && <OfflineNotice />}

        {/* ── SCAN STATS ── */}
        {recentScans.length > 0 && (
          <div className="flex items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3 shadow-raised">
            <div className="flex items-center gap-2 text-caption text-muted">
              <QrCode className="h-3.5 w-3.5" />
              <span>Today</span>
            </div>
            <div className="flex items-center gap-1.5 text-caption">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              <span className="font-medium text-success">{todaySuccessCount}</span>
            </div>
            <div className="flex items-center gap-1.5 text-caption">
              <XCircle className="h-3.5 w-3.5 text-danger" />
              <span className="font-medium text-danger">{todayFailCount}</span>
            </div>
          </div>
        )}

        {/* ── CAMERA SCANNER ── */}
        <div className="space-y-3">
          <QrScanner
            onScan={handleScanToken}
            paused={isCameraPaused}
            className="aspect-square w-full rounded-2xl shadow-raised"
          />
          <div className="flex items-center justify-between px-1 text-caption text-muted">
            <span>Point camera at the student&apos;s live QR code</span>
            {isCameraPaused && (
              <span className="font-mono text-micro text-accent">Camera paused</span>
            )}
          </div>
        </div>

        {/* ── SCANNING & VERIFYING STATE ── */}
        {scanning && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-accent/30 bg-accent-light/10 p-5 shadow-raised">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
              <div>
                <p className="text-body font-semibold text-ink">
                  {previewLoading ? "Verifying QR code..." : "Recording movement..."}
                </p>
                <p className="text-caption text-muted">
                  {previewLoading
                    ? "Validating credentials and fetching student record"
                    : "Updating gate records"}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleCancelScan}>
              Cancel
            </Button>
          </div>
        )}

        {/* ── SCAN RESULT WITH AUTO-RESET ── */}
        {currentResult && !scanning && (
          <div
            className={cn(
              "relative overflow-hidden rounded-xl border p-6 shadow-raised transition-all",
              currentResult.success
                ? "border-success/30 bg-success-light/10"
                : "border-danger/30 bg-danger-light/10",
            )}
          >
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-full",
                  currentResult.success
                    ? "bg-success-light"
                    : "bg-danger-light",
                )}
              >
                {currentResult.success ? (
                  <CheckCircle2 className="h-8 w-8 text-success" />
                ) : (
                  <XCircle className="h-8 w-8 text-danger" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={cn(
                      "text-h3 font-semibold",
                      currentResult.success ? "text-success" : "text-danger",
                    )}
                  >
                    {currentResult.success ? "Let them through" : "Do not let them through"}
                  </p>
                  {currentResult.scanType && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-micro font-semibold uppercase",
                        currentResult.scanType === "EXIT_SCAN"
                          ? "bg-warning-light text-warning"
                          : "bg-success-light text-success",
                      )}
                    >
                      {currentResult.scanType === "EXIT_SCAN" ? "Exit" : "Return"}
                    </span>
                  )}
                </div>

                <p className="mt-1 text-body text-ink">
                  {currentResult.message}
                </p>

                <div className="mt-3 flex items-center gap-3 text-caption text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(currentResult.timestamp, "HH:mm:ss")} IST
                  </span>
                  {autoResetSeconds !== null && (
                    <span className="inline-flex items-center gap-1 font-mono text-micro text-accent">
                      Next scan in {autoResetSeconds}s…
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button size="guard" block onClick={handleReset}>
                <RotateCcw className="h-5 w-5 mr-1" aria-hidden />
                Scan next pass now
              </Button>
            </div>
          </div>
        )}

        {/* ── RECENT SCANS LOG ── */}
        {recentScans.length > 0 && (
          <div className="rounded-xl border border-border bg-surface shadow-raised">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h3 className="flex items-center gap-2 text-body font-semibold text-ink">
                <History className="h-4 w-4 text-muted" />
                Recent Scans
              </h3>
              <span className="text-caption text-muted">
                Last {recentScans.length}
              </span>
            </div>
            <div className="divide-y divide-border">
              {recentScans.map((scan, i) => (
                <div
                  key={`${scan.timestamp.getTime()}-${i}`}
                  className="flex items-center gap-3 px-5 py-3 text-body transition-colors hover:bg-surface-sunken/40"
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      scan.success
                        ? "bg-success-light text-success"
                        : "bg-danger-light text-danger",
                    )}
                  >
                    {scan.success ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("font-medium", scan.success ? "text-success" : "text-danger")}>
                        {scan.success ? "Approved" : "Denied"}
                      </span>
                      {scan.scanType && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-micro font-medium",
                            scan.scanType === "EXIT_SCAN"
                              ? "bg-warning-light text-warning"
                              : "bg-success-light text-success",
                          )}
                        >
                          {scan.scanType === "EXIT_SCAN" ? "Exit" : "Return"}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-caption text-muted">
                      {scan.message}
                    </p>
                  </div>
                  <span className="shrink-0 text-caption text-muted">
                    {format(scan.timestamp, "HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── GUARD CONFIRMATION DIALOG ── */}
      <AlertDialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open && !confirming) handleDiscard();
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-md px-2.5 py-1 font-mono text-micro font-semibold uppercase",
                  isExitScan
                    ? "bg-warning-light text-warning"
                    : "bg-success-light text-success",
                )}
              >
                {isExitScan ? "Exit Verification" : "Check-in Verification"}
              </span>
            </div>
            <AlertDialogTitle className="text-h3 font-semibold text-ink pt-1">
              {isExitScan ? "Confirm Campus Exit" : "Confirm Hostel Return"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-caption text-muted">
              Verify the student&apos;s physical appearance and details before recording the{" "}
              {isExitScan ? "exit" : "check-in"}.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 rounded-xl border border-border bg-surface-sunken p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent">
                <User className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-body font-semibold text-ink">
                  {preview?.student?.name ?? "Unknown"}
                </p>
                <p className="truncate text-caption text-muted font-mono">
                  {preview?.student?.rollNumber ?? "No roll number"}
                  {preview?.student?.roomNumber
                    ? ` · Room ${preview.student.roomNumber}`
                    : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-border pt-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-caption font-semibold text-ink">
                  {preview?.student?.hostelName ?? "No hostel assigned"}
                </p>
                <p className="truncate text-caption text-muted">
                  {formatLeaveWindow(preview?.leave)}
                </p>
              </div>
            </div>
          </div>

          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel asChild>
              <Button
                variant="outline"
                size="lg"
                disabled={confirming}
                onClick={handleDiscard}
                className="flex-1"
              >
                Not this student
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                size="lg"
                onClick={handleConfirm}
                loading={confirming}
                loadingText="Recording…"
                className="flex-1"
              >
                <CheckCircle2 className="h-5 w-5 mr-1" aria-hidden />
                {isExitScan ? "Record exit" : "Record return"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
