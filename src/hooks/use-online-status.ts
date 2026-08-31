"use client";

import * as React from "react";

/**
 * Whether the browser currently has a network connection.
 *
 * `useSyncExternalStore` rather than state plus an effect: this is an external
 * store, and the server has no view of it. The server snapshot is `true` so a
 * field screen never renders an offline warning it would immediately retract.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOnlineStatus(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );
}
