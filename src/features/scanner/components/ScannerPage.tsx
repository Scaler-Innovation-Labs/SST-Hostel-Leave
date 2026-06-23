"use client";

import { useState } from "react";

import { Camera, Loader2, Type } from "lucide-react";

import { QrScanner } from "@/components/qr/QrScanner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { scanQr } from "@/lib/api/movement-api";
import { cn } from "@/lib/utils";

type ScanResult = {
  success: boolean;
  message: string;
};

export function ScannerPage() {
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [token, setToken] = useState("");
  const [scanType, setScanType] = useState<"EXIT_SCAN" | "RETURN_SCAN">("EXIT_SCAN");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  const handleScanToken = async (rawToken: string) => {
    if (!rawToken.trim()) return;
    setToken(rawToken);
    setScanning(true);
    setResult(null);
    try {
      await scanQr(rawToken.trim(), scanType);
      setResult({ success: true, message: "Scan successful" });
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : "Scan failed",
      });
    } finally {
      setScanning(false);
    }
  };

  const handleReset = () => {
    setToken("");
    setResult(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR Scanner"
        description="Scan student QR passes for exit/entry."
      />

      <div className="mx-auto max-w-md space-y-6">
        {/* Mode Toggle */}
        <div className="flex gap-2">
          <Button
            variant={mode === "camera" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("camera")}
            className="gap-1.5"
          >
            <Camera className="h-4 w-4" />
            Camera
          </Button>
          <Button
            variant={mode === "manual" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("manual")}
            className="gap-1.5"
          >
            <Type className="h-4 w-4" />
            Manual
          </Button>
        </div>

        {/* Scan Type Selector */}
        <div className="flex gap-2">
          <Button
            variant={scanType === "EXIT_SCAN" ? "default" : "outline"}
            size="sm"
            onClick={() => setScanType("EXIT_SCAN")}
          >
            Exit Scan
          </Button>
          <Button
            variant={scanType === "RETURN_SCAN" ? "default" : "outline"}
            size="sm"
            onClick={() => setScanType("RETURN_SCAN")}
          >
            Return Scan
          </Button>
        </div>

        {/* Scanner / Input */}
        {mode === "camera" ? (
          <div className="space-y-4">
            <QrScanner
              onScan={handleScanToken}
              className="aspect-square w-full rounded-2xl"
            />
            <p className="text-center text-xs text-muted-foreground">
              Point the camera at the student&apos;s QR code
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-4 text-base font-semibold">Manual Entry</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Token</label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste or type the QR token..."
                  className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm font-mono focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleScanToken(token)}
                  disabled={scanning || !token.trim()}
                  className="flex-1"
                >
                  {scanning ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    "Scan"
                  )}
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  Reset
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div
            className={cn(
              "rounded-2xl border p-6 shadow-sm",
              result.success
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-destructive/30 bg-destructive/5",
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <p
                  className={cn(
                    "text-sm font-medium",
                    result.success ? "text-emerald-600" : "text-destructive",
                  )}
                >
                  {result.success ? "Approved" : "Denied"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{result.message}</p>
              </div>
              <span className={cn("text-2xl", result.success ? "text-emerald-500" : "text-destructive")}>
                {result.success ? "✓" : "✗"}
              </span>
            </div>
          </div>
        )}

        {/* Auto-scan feedback */}
        {scanning && (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Processing scan...</span>
          </div>
        )}
      </div>
    </div>
  );
}
