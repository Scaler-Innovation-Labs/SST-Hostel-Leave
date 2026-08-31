import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The design system's colour scale. Registered with tailwind-merge so it can
 * tell a colour from a size: without this, `text-body` is not a font size it
 * recognises, so it falls into the text-colour group and a later `text-muted`
 * silently deletes it — and `text-on-fill` on a filled control is dropped the
 * same way, which is how invisible button labels shipped once.
 */
const COLORS = [
  "bg",
  "surface",
  "surface-sunken",
  "surface-hover",
  "surface-ink",
  "surface-navy",
  "on-dark",
  "on-fill",
  "ink",
  "muted",
  "border-strong",
  "accent",
  "accent-light",
  "accent-dark",
  "success",
  "success-light",
  "warning",
  "warning-light",
  "danger",
  "danger-light",
  "info",
  "info-light",
] as const;

/** The named type steps. `text-body` always means 14/21; it cannot drift. */
const TEXT_SIZES = [
  "display",
  "h1",
  "h2",
  "h3",
  "body-lg",
  "body",
  "small",
  "caption",
  "micro",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [...COLORS],
      text: [...TEXT_SIZES],
      /** Density-driven: `p-card`, `h-row`, `min-h-tap`. */
      spacing: ["card", "row", "tap"],
      shadow: ["raised", "raised-hover", "raised-lift", "glow", "sheen"],
      tracking: ["snug"],
      ease: ["standard", "decelerate", "accelerate"],
    },
    classGroups: {
      /**
       * Tailwind v4 has no duration theme namespace, so the motion steps are
       * static utilities and tailwind-merge has to be told they conflict with
       * each other and with `duration-<number>`.
       */
      duration: [{ duration: ["instant", "fast", "base", "slow"] }],
      /** The two sanctioned gradients plus the grid texture. */
      "bg-image": [
        { bg: ["scaler-depth", "scaler-ink", "technical-grid"] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
