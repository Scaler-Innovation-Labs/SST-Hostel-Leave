"use client";

import { format } from "date-fns";
import {
  CheckCircle2,
  Clock,
  History,
  Loader2,
  QrCode,
  XCircle,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { QrScanner } from "@/components/qr/QrScanner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { scanQr } from "@/lib/api/movement-api";
import { cn } from "@/lib/utils";

type ScanResult = {
  success: boolean;
  message: string;
  timestamp: Date;
  scanType?: "EXIT_SCAN" | "RETURN_SCAN";
};

export function ScannerPage() {
  const [scanning, setScanning] = useState(false);
  const [currentResult, setCurrentResult] = useState<ScanResult | null>(null);
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);

  const handleScanToken = useCallback(async (rawToken: string) => {
    if (!rawToken.trim()) return;
    setScanning(true);
    setCurrentResult(null);
    try {
      const data: any = await scanQr(rawToken.trim());
      const result: ScanResult = {
        success: true,
        message: "Scan successful",
        timestamp: new Date(),
        scanType: data?.scanType,
      };
      setCurrentResult(result);
      setRecentScans((prev) => [result, ...prev].slice(0, 10));
    } catch (err) {
      const result: ScanResult = {
        success: false,
        message: err instanceof Error ? err.message : "Scan failed",
        timestamp: new Date(),
      };
      setCurrentResult(result);
      setRecentScans((prev) => [result, ...prev].slice(0, 10));
    } finally {
      setScanning(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setCurrentResult(null);
  }, []);

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
        title="QR Scanner"
        description="Scan student QR passes for exit/entry verification."
      />

      <div className="mx-auto max-w-2xl space-y-6">
        {/* ── SCAN STATS ── */}
        {recentScans.length > 0 && (
          <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <QrCode className="h-3.5 w-3.5" />
              <span>Today</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="font-medium text-emerald-600">{todaySuccessCount}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <XCircle className="h-3.5 w-3.5 text-red-500" />
              <span className="font-medium text-red-600">{todayFailCount}</span>
            </div>
          </div>
        )}

        {/* ── CAMERA SCANNER ── */}
        <div className="space-y-4">
          <QrScanner
            onScan={handleScanToken}
            className="aspect-square w-full rounded-2xl"
          />
          <p className="text-center text-xs text-muted-foreground">
            Point the camera at the student&apos;s QR code
          </p>
        </div>

        {/* ── SCANNING STATE ── */}
        {scanning && (
          <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">Processing scan...</p>
              <p className="text-xs text-muted-foreground">Verifying QR pass and recording movement</p>
            </div>
          </div>
        )}

        {/* ── SCAN RESULT ── */}
        {currentResult && !scanning && (
          <div
            className={cn(
              "relative overflow-hidden rounded-xl border p-6 shadow-sm transition-all",
              currentResult.success
                ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10"
                : "border-red-500/30 bg-gradient-to-br from-red-500/5 to-red-500/10",
            )}
          >
            {/* Success/Error icon */}
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-full",
                  currentResult.success
                    ? "bg-emerald-500/10"
                    : "bg-red-500/10",
                )}
              >
                {currentResult.success ? (
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-500" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className={cn(
                      "text-lg font-semibold",
                      currentResult.success ? "text-emerald-600" : "text-red-600",
                    )}
                  >
                    {currentResult.success ? "Scan Approved" : "Scan Denied"}
                  </p>
                  {currentResult.scanType && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        currentResult.scanType === "EXIT_SCAN"
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-emerald-500/10 text-emerald-600",
                      )}
                    >
                      {currentResult.scanType === "EXIT_SCAN" ? "Exit" : "Return"}
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  {currentResult.message}
                </p>

                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(currentResult.timestamp, "h:mm:ss a")}
                  </span>
                </div>
              </div>
            </div>

            {/* Action button */}
            <div className="mt-4 flex justify-end">
              <Button
                size="sm"
                variant={currentResult.success ? "default" : "outline"}
                onClick={handleReset}
                className="gap-1.5"
              >
                <QrCode className="h-4 w-4" />
                Scan Next
              </Button>
            </div>
          </div>
        )}

        {/* ── RECENT SCANS ── */}
        {recentScans.length > 0 && (
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <History className="h-4 w-4 text-muted-foreground" />
                Recent Scans
              </h3>
              <span className="text-xs text-muted-foreground">
                Last {recentScans.length}
              </span>
            </div>
            <div className="divide-y divide-border">
              {recentScans.map((scan, i) => (
                <div
                  key={`${scan.timestamp.getTime()}-${i}`}
                  className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-muted/30"
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      scan.success
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-red-500/10 text-red-500",
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
                      <span className={cn("font-medium", scan.success ? "text-emerald-600" : "text-red-600")}>
                        {scan.success ? "Approved" : "Denied"}
                      </span>
                      {scan.scanType && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                            scan.scanType === "EXIT_SCAN"
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-emerald-500/10 text-emerald-600",
                          )}
                        >
                          {scan.scanType === "EXIT_SCAN" ? "Exit" : "Return"}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {scan.message}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {format(scan.timestamp, "h:mm a")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
