"use client";

import { useTheme } from "next-themes";
import { useLayoutEffect, useRef } from "react";

/**
 * Forces dark mode for the marketing/landing page.
 *
 * Runs in a layout effect so the `dark` class is applied before first paint
 * (no flash for users with a light preference). On unmount (navigating away)
 * the user's previous theme — including the `system` preference — is restored
 * via both the DOM class and the theme provider state.
 */
export function ForceDarkMode() {
  const { theme, setTheme } = useTheme();
  const previousTheme = useRef<string | null>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");

    previousTheme.current = theme ?? null;

    // Apply dark synchronously, before paint, so there is no flash.
    root.classList.add("dark");
    root.classList.remove("light");

    // Align provider state so OS theme changes while on the landing page
    // don't switch it back to light.
    setTheme("dark");

    return () => {
      root.classList.remove("light");
      if (hadDark) root.classList.add("dark");
      if (previousTheme.current) setTheme(previousTheme.current);
    };
    // Run once on mount; the preference is captured at mount time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
