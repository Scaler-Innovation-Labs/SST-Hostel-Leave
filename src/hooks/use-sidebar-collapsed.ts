"use client";

import * as React from "react";

const STORAGE_KEY = "sst.sidebar.collapsed";
const EVENT = "sst:sidebar-collapsed";

/**
 * The sidebar's collapsed preference, read from localStorage.
 *
 * `useSyncExternalStore` rather than `useState` + an effect: localStorage is
 * an external store, the server has no view of it, and this is the primitive
 * that lets the server render the expanded column and the client correct it
 * without a cascading render.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    // A browser refusing storage just means the sidebar starts expanded.
    return false;
  }
}

/** The server always renders the expanded column — see the shell's reservation. */
function getServerSnapshot(): boolean {
  return false;
}

export function useSidebarCollapsed(): [boolean, (next: boolean) => void] {
  const collapsed = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const setCollapsed = React.useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Preference is not persisted, but the toggle must still work.
    }
    // `storage` only fires in *other* tabs, so this tab needs its own signal.
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [collapsed, setCollapsed];
}
