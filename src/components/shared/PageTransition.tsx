"use client";

import { type ReactNode, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type PageTransitionProps = {
  children: ReactNode;
  className?: string;
};

export function PageTransition({ children, className }: PageTransitionProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={cn(
        "transition-all duration-300 ease-out",
        mounted
          ? "translate-y-0 opacity-100"
          : "translate-y-2 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
