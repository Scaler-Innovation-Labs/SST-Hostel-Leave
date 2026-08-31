"use client";

import { useAuth, useSignIn } from "@clerk/nextjs";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, Refusal, TECH_LABEL } from "@/design-system/sst";

export default function LoginPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { signIn, isLoaded: isSignInLoaded } = useSignIn();
  const [failure, setFailure] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/redirect");
    }
  }, [isLoaded, isSignedIn, router]);

  async function signInWithGoogle() {
    if (!isSignInLoaded) return;
    setFailure(null);
    setRedirecting(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/redirect",
      });
    } catch (error) {
      setRedirecting(false);
      setFailure(
        error instanceof Error
          ? error.message
          : "The sign-in service didn't respond."
      );
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-raised">
          <div className="flex flex-col items-center text-center">
            <Image
              src="/logosst.png"
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 rounded-lg"
              priority
            />
            <p className={`mt-5 ${TECH_LABEL}`}>SST Hostel Leave</p>
            <h1 className="mt-2 text-h2 tracking-tight text-ink">
              Sign in to continue
            </h1>
            <p className="mt-2 text-body text-muted">
              Use your institutional Google account. Your role decides which
              console you land in.
            </p>
          </div>

          <div className="mt-8">
            <Button
              block
              size="lg"
              onClick={signInWithGoogle}
              disabled={!isSignInLoaded}
              loading={redirecting}
              loadingText="Taking you to Google…"
            >
              Continue with Google
            </Button>
          </div>

          {failure && (
            <Refusal
              className="mt-6"
              what="We couldn't start sign-in"
              why={failure}
              whatNow="Try again in a moment. If it keeps failing, contact the hostel office."
            />
          )}

          <p className="mt-8 text-center text-caption text-muted">
            Only authorised institutional accounts can access this platform.
          </p>
        </div>

        <p className="mt-6 text-center text-caption text-muted">
          Parents don&apos;t sign in — approval links are sent to you directly.
        </p>
      </div>
    </main>
  );
}
