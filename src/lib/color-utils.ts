/**
 * Convert a hex color to an 8-digit hex with the given alpha.
 * Returns null when the input is not a 3- or 6-digit hex color.
 */
export function toHexAlpha(hex: string, alpha: string): string | null {
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return `${hex}${alpha}`;
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    const full = hex
      .slice(1)
      .split("")
      .map((c) => c + c)
      .join("");
    return `#${full}${alpha}`;
  }
  return null;
}

/**
 * Soft, low-alpha background wash for a hex color — used to tint card surfaces
 * while keeping text readable. Returns undefined for non-hex colors.
 */
export function softTint(color: string, alpha = "1A"): string | undefined {
  if (!color || !/^#/.test(color)) return undefined;
  return toHexAlpha(color, alpha) ?? undefined;
}

/**
 * Horizontal gradient banner for a hex color — fades from transparent on the
 * left to a subtle peak on the right across the top of a card. Used to make a
 * card's leave type distinguishable without washing out the content.
 */
export function topBannerGradient(color: string): string | undefined {
  if (!color || !/^#/.test(color)) return undefined;
  const end = toHexAlpha(color, "33");
  return end ? `linear-gradient(to right, transparent, ${end})` : undefined;
}