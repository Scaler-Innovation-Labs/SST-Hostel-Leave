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
    <p className="text-sm text-muted-foreground">
      Signing you out in{" "}
      <span className="font-medium text-foreground">
        {countdown}
      </span>{" "}
      second{countdown !== 1 ? "s" : ""}...
    </p>
  );
}
