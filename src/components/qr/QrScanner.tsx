"use client";

import type { IScannerError, ScannerErrorKind } from "@yudiel/react-qr-scanner";
import { Scanner } from "@yudiel/react-qr-scanner";
import { CameraOff, QrCode, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

type ScannerStatus = "loading" | "active" | "error";

const ERROR_MESSAGES: Record<ScannerErrorKind, string> = {
  "permission-denied": "Camera access denied. Please allow camera permissions in your browser settings and try again.",
  "no-camera": "No camera found on this device.",
  "in-use": "Camera is already in use by another application.",
  overconstrained: "Camera does not support the required resolution.",
  "insecure-context": "Camera access requires a secure (HTTPS) connection.",
  unsupported: "QR scanning is not supported on this browser.",
  aborted: "Camera access was cancelled.",
  security: "Camera access blocked by security policy.",
  "type-error": "An unexpected error occurred while accessing the camera.",
  unknown: "Camera unavailable. Check your camera connection and try again.",
};

function getScannerErrorMessage(kind: ScannerErrorKind): string {
  return ERROR_MESSAGES[kind] ?? ERROR_MESSAGES.unknown;
}

type QrScannerProps = {
  onScan: (token: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

export function QrScanner({ onScan, onError, className }: QrScannerProps) {
  const [status, setStatus] = useState<ScannerStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [retryCounter, setRetryCounter] = useState(0);

  const handleScan = useCallback(
    (detectedCodes: { rawValue: string }[]) => {
      if (detectedCodes.length > 0) {
        const rawValue = detectedCodes[0]?.rawValue;
        if (rawValue) {
          setStatus("active");
          onScan(rawValue.trim());
        }
      }
    },
    [onScan],
  );

  const handleError = useCallback(
    (err: IScannerError) => {
      if (status === "error") return;
      const message = getScannerErrorMessage(err.kind);
      setStatus("error");
      setErrorMessage(message);
      logger.error("QR scanner error", { kind: err.kind, message });
      onError?.(message);
    },
    [status, onError],
  );

  const handleRetry = useCallback(() => {
    setStatus("loading");
    setErrorMessage("");
    setRetryCounter((c) => c + 1);
  }, []);

  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-black", className)}>
      {status === "loading" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-2 text-white">
            <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Starting camera...</span>
          </div>
        </div>
      )}

      {status === "error" ? (
        <div className="flex aspect-square w-full flex-col items-center justify-center gap-4 bg-black/90 p-8">
          <CameraOff className="h-12 w-12 text-white/40" />
          <div className="space-y-1 text-center">
            <p className="text-sm font-medium text-white/80">Camera Error</p>
            <p className="max-w-xs text-xs text-white/50">{errorMessage}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            className="gap-1.5 border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      ) : (
        <Scanner
          key={retryCounter}
          onScan={handleScan}
          onError={handleError}
          components={{
            finder: true,
          }}
          allowMultiple={false}
          scanDelay={500}
          styles={{
            container: { width: "100%", height: "auto" },
            video: { objectFit: "cover" },
          }}
        />
      )}

      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-300",
          status === "active" ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="rounded-2xl border-2 border-white/40 p-16">
          <QrCode className="h-8 w-8 text-white/30" />
        </div>
      </div>
    </div>
  );
}
