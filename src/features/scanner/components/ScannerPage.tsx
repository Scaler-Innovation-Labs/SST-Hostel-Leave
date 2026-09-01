"use client";

import { format } from "date-fns";
import {
  Building2,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  QrCode,
  User,
  XCircle,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

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
  const lastCommitted = useRef<{ token: string; at: number } | null>(null);

  const addResult = useCallback((result: ScanResult) => {
    setCurrentResult(result);
    setRecentScans((prev) => [result, ...prev].slice(0, 10));
  }, []);

  const handleScanToken = useCallback(
    async (rawToken: string) => {
      const token = rawToken.trim();
      if (!token) return;

      // The scanner re-fires every ~500ms while the same QR stays in view.
      // Ignore repeats while the guard is deciding on the first detection.
      if (pendingToken === token) return;

      // Ignore re-scans of a QR that was just committed to (the pass is now
      // used — showing a fresh denied panel right after an approval is noise).
      if (
        lastCommitted.current &&
        lastCommitted.current.token === token &&
        Date.now() - lastCommitted.current.at < 5000
      ) {
        return;
      }

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
            message: data.reason ?? "QR is not scannable",
            timestamp: new Date(),
            scanType: data.scanType ?? undefined,
          });
          setPendingToken(null);
        } else {
          setPreview(data);
        }
      } catch (err) {
        addResult({
          success: false,
          message: err instanceof Error ? err.message : "Failed to verify QR",
          timestamp: new Date(),
        });
        setPendingToken(null);
      } finally {
        setPreviewLoading(false);
        setScanning(false);
      }
    },
    [pendingToken, addResult],
  );

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
          : (data.failureReason ?? "Scan failed"),
        timestamp: new Date(),
        scanType: data.scanType,
      });
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
    }
  }, [pendingToken, addResult]);

  const handleDiscard = useCallback(() => {
    setPendingToken(null);
    setPreview(null);
  }, []);

  const handleReset = useCallback(() => {
    setCurrentResult(null);
  }, []);

  const isExitScan = preview?.scanType === "EXIT_SCAN";

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
        description="Point the camera at the student's code. Check the name and photo before you record anything."
        status={
          online
            ? { label: "Connected", tone: "success" }
            : { label: "No connection", tone: "danger" }
        }
      />

      <div className="mx-auto max-w-2xl space-y-6">
        {/*
          A scanner that cannot reach the server cannot verify anything. It
          says so plainly rather than appearing to work.
        */}
        {!online && <OfflineNotice />}

        {/* ── SCAN STATS ── */}
        {recentScans.length > 0 && (
          <div className="flex items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3">
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
        <div className="space-y-4">
          <QrScanner
            onScan={handleScanToken}
            className="aspect-square w-full rounded-2xl"
          />
          <p className="text-center text-caption text-muted">
            Point the camera at the student&apos;s QR code
          </p>
        </div>

        {/* ── SCANNING STATE ── */}
        {scanning && (
          <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
            <div>
              <p className="text-body font-medium">
                {previewLoading ? "Verifying QR..." : "Processing scan..."}
              </p>
              <p className="text-caption text-muted">
                {previewLoading
                  ? "Fetching student details for confirmation"
                  : "Recording movement"}
              </p>
            </div>
          </div>
        )}

        {/* ── SCAN RESULT ── */}
        {currentResult && !scanning && (
          <div
            className={cn(
              "relative overflow-hidden rounded-xl border p-6 shadow-sm transition-all",
              currentResult.success
                ? "border-success/30 bg-gradient-to-br from-success/5 to-success/10"
                : "border-danger/30 bg-gradient-to-br from-danger/5 to-danger/10",
            )}
          >
            {/* Success/Error icon */}
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
                <div className="flex items-center gap-2">
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
                        "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-micro font-medium",
                        currentResult.scanType === "EXIT_SCAN"
                          ? "bg-warning-light text-warning"
                          : "bg-success-light text-success",
                      )}
                    >
                      {currentResult.scanType === "EXIT_SCAN" ? "Exit" : "Return"}
                    </span>
                  )}
                </div>

                <p className="mt-1 text-body-lg text-muted">
                  {currentResult.message}
                </p>

                <div className="mt-3 flex items-center gap-3 text-caption text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(currentResult.timestamp, "HH:mm:ss")} IST
                  </span>
                </div>
              </div>
            </div>

            {/* Action button */}
            <div className="mt-4 flex justify-end">
              <Button size="guard" block onClick={handleReset}>
                <QrCode className="h-8 w-8" aria-hidden />
                Scan the next pass
              </Button>
            </div>
          </div>
        )}

        {/* ── RECENT SCANS ── */}
        {recentScans.length > 0 && (
          <div className="rounded-xl border border-border bg-surface shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h3 className="flex items-center gap-2 text-body font-semibold">
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
                  className="flex items-center gap-3 px-5 py-3 text-body transition-colors hover:bg-surface-sunken/30"
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isExitScan ? "Confirm Exit" : "Confirm Check-in"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Verify the student&apos;s identity before recording the{" "}
              {isExitScan ? "exit" : "check-in"}.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 rounded-xl border border-border bg-surface-sunken/30 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
                <User className="h-5 w-5 text-accent" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">{preview?.student?.name ?? "Unknown"}</p>
                <p className="truncate text-caption text-muted">
                  {preview?.student?.rollNumber ?? "No roll number"}
                  {preview?.student?.roomNumber
                    ? ` · Room ${preview.student.roomNumber}`
                    : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
                <Building2 className="h-5 w-5 text-accent" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {preview?.student?.hostelName ?? "No hostel"}
                </p>
                <p className="truncate text-caption text-muted">
                  {formatLeaveWindow(preview?.leave)}
                </p>
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline" size="lg" disabled={confirming} onClick={handleDiscard}>
                Not this student
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                size="lg"
                onClick={handleConfirm}
                loading={confirming}
                loadingText="Recording…"
              >
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                {isExitScan ? "Record the exit" : "Record the return"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}