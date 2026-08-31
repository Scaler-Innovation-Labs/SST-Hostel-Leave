"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import * as React from "react";

type Props = {
  children: React.ReactNode;
};

export function ThemeProvider({
  children,
}: Props) {
  return (
    /**
     * Class strategy, not media: the `.dark` class is applied by an explicit
     * user choice so it always beats the OS setting. next-themes injects a
     * script that applies the stored theme before first paint — without it,
     * every load flashes the wrong theme.
     */
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}