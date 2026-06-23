import Image from "next/image";
import Link from "next/link";

type LogoProps = {
  href?: string;
};

export function Logo({ href = "/" }: LogoProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3"
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