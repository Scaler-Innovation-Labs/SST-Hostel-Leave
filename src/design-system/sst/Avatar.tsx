import { cn } from "@/lib/utils";

/**
 * The initials shown when there is no photograph. Two characters at most —
 * three initials in a 32px circle is unreadable.
 */
export function initialsOf(name: string | null | undefined): string {
  return (name ?? "")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const SIZES = {
  sm: "h-7 w-7 text-micro",
  md: "h-9 w-9 text-caption",
  lg: "h-12 w-12 text-body",
  xl: "h-16 w-16 text-h3",
} as const;

type AvatarProps = {
  name: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
};

/**
 * An identity marker, not a status.
 *
 * Deliberately one colour rather than a hash into a rainbow: colour in this
 * system carries meaning, and five tinted avatars in a queue compete with the
 * status badges beside them for the reader's attention. Rounded-full is
 * correct here — avatars and status dots are the only things that get it.
 */
export function Avatar({ name, size = "md", className }: AvatarProps) {
  const initials = initialsOf(name);

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        "bg-accent-light font-semibold text-accent ring-1 ring-inset ring-accent/10",
        SIZES[size],
        className
      )}
    >
      {initials || "?"}
    </span>
  );
}
