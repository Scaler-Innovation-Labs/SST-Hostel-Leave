import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

type LogoProps = {
  href?: string;
  className?: string;
};

export function Logo({ href = "/", className }: LogoProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        className
      )}
    >
      <Image
        src="/logosst.png"
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 rounded-md"
        priority
      />

      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-small font-semibold text-ink">
          SST Hostel
        </span>
        <span className="truncate font-mono text-micro uppercase tracking-wider text-muted">
          Leave Platform
        </span>
      </span>
    </Link>
  );
}

export default Logo;
