import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Three genuinely different people use these tools, so one component serves
 * all three: `student` on a phone between classes, `admin` on a desktop
 * scanning dense tables, `guard` at a gate outdoors, possibly gloved.
 *
 * Setting `data-density` redefines the card padding, row height, tap target
 * and body size tokens for the whole subtree — `p-card`, `h-row` and
 * `min-h-tap` follow without a single conditional in the components.
 */
type Density = "student" | "admin" | "guard";

type DensityProviderProps = {
  density: Density;
  className?: string;
  children: React.ReactNode;
};

function DensityProvider({
  density,
  className,
  children,
}: DensityProviderProps) {
  return (
    <div data-density={density} className={cn("contents", className)}>
      {children}
    </div>
  );
}

export { DensityProvider };
export type { Density };
