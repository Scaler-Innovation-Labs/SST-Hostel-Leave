"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type QrCodeDisplayProps = {
  /** Hosted PNG URL (same bytes as the approval email): /api/v1/qr/{passId}/image */
  imageUrl: string;
  size?: number;
  className?: string;
  onError?: () => void;
}

export function QrCodeDisplay({ imageUrl, size = 200, className, onError }: QrCodeDisplayProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (error) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-danger/10 p-4 text-body text-danger">
        {error}
      </div>
    );
  }

  return (
    <div className={cn("inline-block rounded-xl bg-white p-3 shadow-sm", className)}>
      {!loaded && (
        <div className="flex items-center justify-center" style={{ width: size, height: size }}>
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="QR Code"
        width={size}
        height={size}
        className="block"
        style={{ imageRendering: "pixelated", display: loaded ? "block" : "none" }}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setError("Failed to load QR");
          onError?.();
        }}
      />
    </div>
  );
}
