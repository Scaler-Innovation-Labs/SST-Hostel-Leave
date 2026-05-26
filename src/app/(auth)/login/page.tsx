"use client";

import { useAuth, useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { signIn, isLoaded: isSignInLoaded } = useSignIn();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/redirect");
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <main
      className="
        relative flex min-h-screen
        items-center justify-center
        overflow-hidden
        bg-background px-6
      "
    >
      {/* GRID */}
      <div
        className="
          absolute inset-0
          opacity-[0.03]
        "
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)
          `,
          backgroundSize: "72px 72px",
        }}
      />

      {/* GLOW */}
      <div
        className="
          absolute left-1/2 top-1/2
          h-[700px] w-[700px]
          -translate-x-1/2 -translate-y-1/2
          rounded-full
          bg-blue-500/10
          blur-[140px]
        "
      />

      {/* LOGIN SURFACE */}
      <div
        className="
          relative w-full max-w-md
          rounded-[32px]
          border border-white/[0.04]
          bg-white/[0.02]
          p-10
          backdrop-blur-2xl
        "
      >
        {/* LOGO */}
        <div
          className="
            flex items-center justify-center
          "
        >
          <div
            className="
              flex size-16 items-center
              justify-center
              rounded-2xl
              bg-blue-500/10
              text-2xl font-semibold
              text-blue-400
            "
          >
            S
          </div>
        </div>

        {/* TITLE */}
        <div className="mt-8 text-center">
          <h1 className="text-3xl font-semibold text-white">
            Welcome Back
          </h1>

          <p
            className="
              mt-3 text-sm
              leading-7
              text-white/45
            "
          >
            Login to access hostel leave
            approvals, QR passes, and
            operational workflows.
          </p>
        </div>

        {/* BUTTON */}
        <div className="mt-10">
          <button
            type="button"
            onClick={async () => {
              if (!isSignInLoaded) return;

              await signIn.authenticateWithRedirect({
                strategy: "oauth_google",
                redirectUrl: "/sso-callback",
                redirectUrlComplete: "/redirect",
              });
            }}
            disabled={!isSignInLoaded}
            className="
              flex w-full items-center
              justify-center gap-3
              rounded-2xl
              bg-white
              px-5 py-4
              text-sm font-medium
              text-black
              transition-transform
              hover:scale-[1.01]
              disabled:cursor-not-allowed
              disabled:opacity-70
            "
          >
            Continue with Google
          </button>
        </div>

        {/* FOOTER */}
        <p
          className="
            mt-8 text-center
            text-xs leading-6
            text-white/35
          "
        >
          Only authorized institutional
          accounts can access the platform.
        </p>
      </div>
    </main>
  );
}