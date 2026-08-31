"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export function SignOutTimer({
  seconds = 5,
  redirectUrl = "/",
}: {
  seconds?: number;
  redirectUrl?: string;
}) {
  const { signOut } = useClerk();
  const [countdown, setCountdown] = useState(seconds);

  useEffect(() => {
    if (countdown <= 0) {
      signOut({ redirectUrl });
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, signOut, redirectUrl]);

  return (
    <p aria-live="polite" className="text-body text-muted">
      Signing you out in{" "}
      <span className="font-medium tabular-nums text-ink">{countdown}</span>{" "}
      second{countdown === 1 ? "" : "s"}
    </p>
  );
}
