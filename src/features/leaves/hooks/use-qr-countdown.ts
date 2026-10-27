"use client";

import { useCallback, useEffect, useState } from "react";

export const QR_DISPLAY_DURATION_SECONDS = 20;

/**
 * Manages the 20-second active display window for student gate pass QR codes.
 *
 * Uses wall-clock timestamp comparison rather than a naive interval tick so that
 * tab-switching, device sleeping, or backgrounding immediately reflects elapsed time
 * without freezing the countdown.
 */
export function useQrCountdown(durationSeconds = QR_DISPLAY_DURATION_SECONDS) {
  const [targetTime, setTargetTime] = useState<number>(() => Date.now() + durationSeconds * 1000);
  const [timeLeft, setTimeLeft] = useState<number>(durationSeconds);
  const [tokenVersion, setTokenVersion] = useState<number>(() => Date.now());

  const resetCountdown = useCallback(() => {
    const nextTarget = Date.now() + durationSeconds * 1000;
    setTargetTime(nextTarget);
    setTimeLeft(durationSeconds);
    setTokenVersion(Date.now());
  }, [durationSeconds]);

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  const isExpired = timeLeft <= 0;

  return {
    timeLeft,
    isExpired,
    resetCountdown,
    tokenVersion,
  };
}
