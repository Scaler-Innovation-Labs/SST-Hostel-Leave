"use client";

import { useEffect, useRef, useState } from "react";

type SseMessage =
  | { type: "connected"; userId: string }
  | { type: "approvals_update"; total: number; checkedAt: string }
  | { type: "timeout" }
  | { type: "error"; message: string };

export function useNotificationStream() {
  const [lastEvent, setLastEvent] = useState<SseMessage | null>(null);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let mounted = true;

    function connect() {
      if (!mounted) return;

      const es = new EventSource("/api/v1/notifications/stream");
      eventSourceRef.current = es;

      es.onopen = () => {
        if (mounted) setConnected(true);
      };

      es.onmessage = (event) => {
        if (!mounted || !event.data) return;
        try {
          const msg: SseMessage = JSON.parse(event.data);
          if (mounted) {
            setLastEvent(msg);
            if (msg.type === "timeout") {
              es.close();
              retryTimeoutRef.current = setTimeout(connect, 1_000);
            }
          }
        } catch {
          // ignore malformed messages
        }
      };

      es.onerror = () => {
        if (mounted) {
          setConnected(false);
          es.close();
          retryTimeoutRef.current = setTimeout(connect, 5_000);
        }
      };
    }

    connect();

    return () => {
      mounted = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return { lastEvent, connected };
}
