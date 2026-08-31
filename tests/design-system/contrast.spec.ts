import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The contrast audit.
 *
 * Every foreground/background pair the UI actually renders is derived from the
 * real token file and checked against its threshold, so `theme.css` can never
 * claim compliance it does not have. This runs in CI with the rest of the
 * suite: a hue tweak that drops a pair below threshold fails the build.
 */

const THEME_CSS = readFileSync(
  path.resolve(__dirname, "../../src/design-system/theme.css"),
  "utf8"
);

type Theme = "light" | "dark";

/**
 * Pull the `--sst-*: R G B;` triplets out of a block. Light lives on bare
 * `:root`, dark redefines a subset under `.dark`, so the dark palette is the
 * light one with the overrides applied — which also proves no colour is
 * defined only inside the dark block.
 */
function parseBlock(selector: string): Record<string, [number, number, number]> {
  const start = THEME_CSS.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No ${selector} block in theme.css`);
  const end = THEME_CSS.indexOf("\n}", start);
  const body = THEME_CSS.slice(start, end);

  const out: Record<string, [number, number, number]> = {};
  const re = /--sst-([a-z0-9-]+):\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3});/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  return out;
}

const LIGHT = parseBlock(":root");
const DARK = { ...LIGHT, ...parseBlock(".dark") };
const PALETTE: Record<Theme, Record<string, [number, number, number]>> = {
  light: LIGHT,
  dark: DARK,
};

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(
  fg: [number, number, number],
  bg: [number, number, number]
): number {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

type Kind = "text" | "non-text" | "decorative";

const THRESHOLD: Record<Kind, number | null> = {
  text: 4.5,
  "non-text": 3,
  decorative: null,
};

/** The pairs the UI actually renders. `on-fill` is the filled-control label. */
const PAIRS: Array<{ name: string; fg: string; bg: string; kind: Kind }> = [
  { name: "body text on page", fg: "text", bg: "bg", kind: "text" },
  { name: "body text on card", fg: "text", bg: "surface", kind: "text" },
  { name: "muted text on page", fg: "text-muted", bg: "bg", kind: "text" },
  { name: "muted text on card", fg: "text-muted", bg: "surface", kind: "text" },
  { name: "accent link on card", fg: "accent", bg: "surface", kind: "text" },
  {
    name: "accent on accent-light",
    fg: "accent",
    bg: "accent-light",
    kind: "text",
  },
  { name: "label on accent button", fg: "on-fill", bg: "accent", kind: "text" },
  {
    name: "label on accent-dark",
    fg: "text-on-dark",
    bg: "accent-dark",
    kind: "text",
  },
  { name: "label on success button", fg: "on-fill", bg: "success", kind: "text" },
  { name: "label on warning button", fg: "on-fill", bg: "warning", kind: "text" },
  { name: "label on danger button", fg: "on-fill", bg: "danger", kind: "text" },
  { name: "label on info button", fg: "on-fill", bg: "info", kind: "text" },
  { name: "label on ink button", fg: "surface", bg: "text", kind: "text" },
  { name: "success text on wash", fg: "success", bg: "success-light", kind: "text" },
  { name: "warning text on wash", fg: "warning", bg: "warning-light", kind: "text" },
  { name: "danger text on wash", fg: "danger", bg: "danger-light", kind: "text" },
  { name: "text on navy band", fg: "text-on-dark", bg: "surface-navy", kind: "text" },
  { name: "text on ink band", fg: "text-on-dark", bg: "surface-ink", kind: "text" },
  { name: "focus ring on page", fg: "accent", bg: "bg", kind: "non-text" },
  {
    name: "control border on card",
    fg: "border-strong",
    bg: "surface",
    kind: "non-text",
  },
  { name: "divider on card", fg: "border", bg: "surface", kind: "decorative" },
];

describe.each<Theme>(["light", "dark"])("contrast — %s theme", (theme) => {
  const palette = PALETTE[theme];

  it.each(PAIRS)("$name ($kind)", ({ fg, bg, kind }) => {
    const foreground = palette[fg];
    const background = palette[bg];
    expect(foreground, `token --sst-${fg} is not defined`).toBeDefined();
    expect(background, `token --sst-${bg} is not defined`).toBeDefined();

    const ratio = contrast(foreground, background);
    const threshold = THRESHOLD[kind];
    if (threshold === null) return; // reported, never enforced

    expect(
      ratio,
      `${fg} on ${bg} in ${theme} is ${ratio}:1, needs ${threshold}:1`
    ).toBeGreaterThanOrEqual(threshold);
  });
});

describe("theme.css structure", () => {
  it("defines every dark token on :root first", () => {
    const darkOnly = Object.keys(parseBlock(".dark")).filter(
      (token) => !(token in LIGHT)
    );
    expect(
      darkOnly,
      "a colour defined only inside .dark has no light-theme value"
    ).toEqual([]);
  });
});
