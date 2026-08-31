import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Icon components cannot cross the server/client boundary.
 *
 * The navigation map holds Lucide *components*, so a server component that
 * imports it and passes items into a client component crashes the render with
 * "Functions cannot be passed directly to Client Components". Server layouts
 * pass a `nav` key instead and the client shell resolves it.
 *
 * This shipped once. The rule is mechanical, so the check is too.
 */
const SRC = path.resolve(__dirname, "../../src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith(".tsx") || full.endsWith(".ts") ? [full] : [];
  });
}

function isClientComponent(source: string): boolean {
  return /^\s*["']use client["']/.test(source);
}

describe("server/client boundary", () => {
  const files = walk(SRC).filter(
    (file) => !file.endsWith(path.join("constants", "navigation.ts"))
  );

  it("only client components import the navigation map", () => {
    const offenders = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      const importsNav =
        /import\s*\{[^}]*\b(NAVIGATION|STUDENT_BOTTOM_NAV)\b[^}]*\}\s*from\s*["']@\/constants\/navigation["']/s.test(
          source
        );
      return importsNav && !isClientComponent(source);
    });

    expect(
      offenders.map((file) => path.relative(SRC, file)),
      "these import icon components but are not client components"
    ).toEqual([]);
  });

  it("keeps the icon-bearing nav out of server layouts", () => {
    for (const file of files.filter((f) => f.endsWith("layout.tsx"))) {
      const source = readFileSync(file, "utf8");
      if (isClientComponent(source)) continue;
      expect(source, `${path.relative(SRC, file)} passes nav groups directly`)
        .not.toMatch(/groups=\{/);
    }
  });
});
