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
      className={cn("flex items-center gap-3", className)}
    >
      <Image
        src="/logosst.png"
        alt="SST Logo"
        width={40}
        height={40}
        className="rounded-lg"
        priority
      />

      <div className="flex flex-col leading-none">
        <span className="text-sm font-semibold">
          SST Hostel
        </span>

        <span className="text-xs text-muted-foreground">
          Leave Platform
        </span>
      </div>
    </Link>
  );
}

export default Logo;