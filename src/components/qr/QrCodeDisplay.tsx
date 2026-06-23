"use client";

import { Loader2 } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type QrCodeDisplayProps = {
  token: string;
  size?: number;
  className?: string;
}

export function QrCodeDisplay({ token, size = 200, className }: QrCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(token, {
      width: size,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to generate QR");
      });
    return () => {
      cancelled = true;
    };
  }, [token, size]);

  if (error) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("inline-block rounded-xl bg-white p-3 shadow-sm", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt="QR Code"
        width={size}
        height={size}
        className="block"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}
