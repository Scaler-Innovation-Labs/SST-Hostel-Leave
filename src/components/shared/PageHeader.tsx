import type React from "react";

import type { BadgeTone } from "@/design-system/sst";
import { Masthead } from "@/design-system/sst";

type PageHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  /**
   * The mono eyebrow above the title — which console or section this screen
   * belongs to. Defaults to the product name where a screen has not named one.
   */
  eyebrow?: string;
  /** The screen's single standing state, where it has one. */
  status?: { label: string; tone: BadgeTone };
  action?: React.ReactNode;
  className?: string;
};

/**
 * Every top-level screen opens with the same masthead, which is what makes
 * moving between two consoles not feel like two products.
 *
 * This is the adapter for screens still calling the old `title/description/
 * action` shape; new screens use `Masthead` directly and pass a real eyebrow.
 */
export function PageHeader({
  title,
  description,
  eyebrow = "SST Hostel Leave",
  status,
  action,
  className,
}: PageHeaderProps) {
  return (
    <Masthead
      eyebrow={eyebrow}
      title={title}
      description={description}
      status={status}
      actions={action}
      className={className}
    />
  );
}
