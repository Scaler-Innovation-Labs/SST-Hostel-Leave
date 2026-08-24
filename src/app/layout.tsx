import "./globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { SWRProvider } from "@/providers/SWRProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SST Hostel Leave System",
  description:
    "Campus Leave & Movement Management Platform",
};

/**
 * Clerk JS is fetched from the instance's Frontend API domain on every
 * page (root layout mounts ClerkProvider). Preconnecting shaves DNS+TLS
 * off its discovery on slow networks — the landing and login pages load
 * it before any user interaction.
 */
function getClerkFrontendApiOrigin(): string | null {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!pk?.startsWith("pk_test_") && !pk?.startsWith("pk_live_")) return null;
  try {
    const b64 = pk.replace(/^pk_(test|live)_/, "").replace(/\$\$/, "");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    const origin = decoded.split(",")[0]?.trim();
    return origin ? `https://${origin}` : null;
  } catch {
    return null;
  }
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clerkOrigin = getClerkFrontendApiOrigin();

  return (

    <html
      lang="en" suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {clerkOrigin && (
          <>
            <link rel="preconnect" href={clerkOrigin} />
            <link rel="dns-prefetch" href={clerkOrigin} />
          </>
        )}
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider>
          <ClerkProvider
            signInUrl="/login"
            signUpUrl="/login"
            afterSignOutUrl="/login"
            signInFallbackRedirectUrl="/redirect"
            signUpFallbackRedirectUrl="/login"
          >
              <Toaster />
            <SWRProvider>{children}</SWRProvider>
          </ClerkProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
