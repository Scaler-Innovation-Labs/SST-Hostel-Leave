import Link from "next/link";

import { Reveal } from "@/components/marketing/Reveal";

export function CtaSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-8">
        <Reveal>
          <div
            className="
              relative overflow-hidden rounded-[2rem]
              border border-border bg-card/60 px-8 py-16
              text-center backdrop-blur-xl md:py-20
            "
          >
            {/* Corner glow */}
            <div
              aria-hidden
              className="
                absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.14),transparent_55%)]
              "
            />

            <h2 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
              Ready to move
              <span className="bg-linear-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
                {" "}without the paperwork?
              </span>
            </h2>

            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              Students request, parents approve, staff review, guards scan —
              one platform for the entire campus movement lifecycle.
            </p>

            <div className="mt-10">
              <Link
                href="/login"
                className="
                  inline-flex items-center gap-3 rounded-2xl bg-linear-to-r
                  from-blue-500 to-indigo-600 px-8 py-4 text-sm font-medium
                  text-white shadow-[0_0_60px_rgba(59,130,246,0.35)]
                  transition-all duration-300 hover:scale-[1.02]
                "
              >
                Login to Dashboard
                <span>→</span>
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
