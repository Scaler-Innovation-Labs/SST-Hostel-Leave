import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The token rules, enforced mechanically.
 *
 * "No hex literal, no arbitrary value, ever" is only true if something checks.
 * Each of these caught a real violation when it was written — including a
 * seven-colour policy rail and a `border-l-violet-500` that the first colour
 * sweep missed because it only matched the undirected `border-` form.
 */
const SRC = path.resolve(__dirname, "../../src");

/** Vendored shadcn primitives keep the alias names they were written against. */
const VENDOR = path.join(SRC, "components", "ui");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

const FILES = walk(SRC).filter((file) => !file.startsWith(VENDOR));

/**
 * The pre-design-system landing page, restored verbatim from before the
 * revamp (070db3d). It predates the token layer, so the discipline checks
 * below do not apply to it — any new marketing work must still use tokens.
 */
const LEGACY_MARKETING = new Set([
  "app/page.tsx",
  "components/layout/Navbar.tsx",
  ...walk(path.join(SRC, "components", "marketing")).map((file) =>
    path.relative(SRC, file).replace(/\\/g, "/"),
  ),
]);

const SCOPED_FILES = FILES.filter(
  (file) => !LEGACY_MARKETING.has(path.relative(SRC, file).replace(/\\/g, "/")),
);

function offenders(pattern: RegExp): string[] {
  return SCOPED_FILES.flatMap((file) => {
    const matches = readFileSync(file, "utf8").match(pattern) ?? [];
    // path.relative yields backslashes on Windows; the exclusion filters
    // below are written with forward slashes (matching Linux CI), so
    // normalize here to keep both platforms honest.
    const rel = path.relative(SRC, file).replace(/\\/g, "/");
    return matches.map((m) => `${rel}: ${m}`);
  });
}

const HUES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|" +
  "teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

describe("token discipline", () => {
  it("uses no raw Tailwind palette colour", () => {
    // Covers directional and axis variants (border-l-, divide-x-) too, which
    // is exactly where the first sweep left a violet rail behind.
    const pattern = new RegExp(
      `\\b(?:[a-z-]+:)*(?:bg|text|border|ring|divide|fill|stroke|from|via|to|outline|shadow|accent|caret|decoration)(?:-[xytrbles])?-(?:${HUES})-\\d{2,3}\\b`,
      "g"
    );
    expect(offenders(pattern)).toEqual([]);
  });

  it("uses the named type steps, not t-shirt sizes", () => {
    expect(
      offenders(/\b(?:[a-z-]+:)*text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl)\b/g)
    ).toEqual([]);
  });

  it("uses no arbitrary type size", () => {
    expect(offenders(/\btext-\[[^\]]+\]/g)).toEqual([]);
  });

  it("uses no hex literal outside the QR code", () => {
    const found = offenders(/#[0-9a-fA-F]{6}\b/g).filter(
      // The scanner needs true black on true white; that is contrast, not a token.
      (hit) => !hit.startsWith("components/qr/QrCodeDisplay.tsx")
    );
    expect(found).toEqual([]);
  });

  it("reserves bold for the notification count chip", () => {
    const found = offenders(/\bfont-(?:bold|extrabold|black)\b/g).filter(
      (hit) => !hit.startsWith("components/shared/CountBadge.tsx")
    );
    expect(found).toEqual([]);
  });

  it("ships no emoji in the UI", () => {
    expect(
      offenders(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2716}\u{2714}]/gu)
    ).toEqual([]);
  });

  it("scales nothing on interaction", () => {
    // Scaling a control resamples its text and reads as a toy.
    expect(offenders(/\b(?:hover|active|focus):scale-/g)).toEqual([]);
  });

  it("ships none of the banned ambient animations", () => {
    expect(
      offenders(
        /\banimate-(?:aurora|orb-float|mesh-morph|gradient-flow|border-flow|breathe|twinkle|pulse-glow|float|wiggle|bounce-subtle|spin-slow)\b/g
      )
    ).toEqual([]);
  });

  it("never apologises or shrugs in user-facing copy", () => {
    const found = FILES.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return (source.match(/^(?!\s*[/*]).*\b(?:Oops|Something went wrong)\b.*$/gim) ?? [])
        .map((line) => `${path.relative(SRC, file)}: ${line.trim().slice(0, 60)}`);
    });
    expect(found).toEqual([]);
  });

  it("shows no 12-hour clock", () => {
    // §10.9: 24-hour, with the timezone named on first use in a view.
    expect(offenders(/"h+:mm(?::ss)?\s*a"/g)).toEqual([]);
  });
});
