"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useNotificationStream } from "@/features/notifications/hooks/use-notification-stream";

export function useNotificationToast() {
  const { lastEvent } = useNotificationStream();
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (
      lastEvent &&
      lastEvent.type === "approvals_update" &&
      lastEvent.total > 0
    ) {
      const key = `${lastEvent.type}-${lastEvent.checkedAt}`;
      if (notifiedRef.current.has(key)) return;
      notifiedRef.current.add(key);

      toast(`${lastEvent.total} pending approval${lastEvent.total > 1 ? "s" : ""}`, {
        description: "New leave requests need your review",
        duration: 6000,
      });

      // Cleanup old keys
      if (notifiedRef.current.size > 20) {
        const keys = Array.from(notifiedRef.current);
        notifiedRef.current = new Set(keys.slice(-10));
      }
    }
  }, [lastEvent]);
}
