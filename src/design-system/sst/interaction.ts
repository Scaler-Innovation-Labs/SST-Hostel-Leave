/**
 * The interaction vocabulary.
 *
 * Defined once and shared everywhere so a focus ring, an active indicator and
 * a hover response are learned by the user a single time and then recognised
 * on every surface in the product. Import these rather than retyping the class
 * strings — a divergent copy is how "blue line = you are here" stops being
 * true.
 */

/**
 * One focus ring, every interactive element. The accent clears 7.52:1 on white
 * and 6.02:1 on black, so the ring is visible in both themes without a variant.
 */
export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

/** For controls flush against an edge — nav rows, table rows, list items. */
export const FOCUS_INSET =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset";

/**
 * THE RAIL — the signature active indicator. A 2px Scaler Blue edge that grows
 * from the centre when a thing becomes current. Nav, tabs, selected rows.
 * Deliberately identical everywhere.
 */
export const RAIL = {
  bottom:
    "relative after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 " +
    "after:origin-center after:scale-x-0 after:bg-accent " +
    "after:transition-transform after:duration-base after:ease-standard " +
    "data-[state=active]:after:scale-x-100 aria-[current=page]:after:scale-x-100",
  left:
    "relative before:absolute before:inset-y-0 before:left-0 before:w-0.5 " +
    "before:origin-center before:scale-y-0 before:bg-accent " +
    "before:transition-transform before:duration-base before:ease-standard " +
    "data-[state=active]:before:scale-y-100 aria-[current=page]:before:scale-y-100",
} as const;

/** Underline that draws in left-to-right on hover. Precise, not soft. */
export const UNDERLINE =
  "relative after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px " +
  "after:origin-left after:scale-x-0 after:bg-current " +
  "after:transition-transform after:duration-fast after:ease-standard " +
  "hover:after:scale-x-100 focus-visible:after:scale-x-100";

/** Overlay enter/exit. A 2px lift and a fade — a panel arriving, not a pop. */
export const OVERLAY_MOTION =
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 " +
  "data-[state=open]:slide-in-from-top-1 data-[state=open]:duration-base " +
  "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 " +
  "data-[state=closed]:duration-fast";

/** Row/tile hover. Ground shift plus border darkening — never a shadow lift. */
export const HOVER_SURFACE =
  "transition-colors duration-fast ease-standard " +
  "hover:bg-surface-hover hover:border-border-strong";

/** A card that is a link: hover lifts, press settles, nothing ever scales. */
export const HOVER_LIFT =
  "transition-all duration-base ease-standard " +
  "hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-raised-lift " +
  "active:translate-y-px";

export const DISABLED = "disabled:pointer-events-none disabled:opacity-45";

/**
 * The platform's signature small metadata — section counts, units, IDs, role
 * names, timestamps. `tracking-wider` is the 0.14em caps step.
 */
export const TECH_LABEL =
  "font-mono text-micro uppercase tracking-wider text-muted";

/** The same eyebrow on a navy or black band. */
export const TECH_LABEL_ON_DARK =
  "font-mono text-micro uppercase tracking-wider text-white/60";

/** Every figure in a column, a counter or a metric. */
export const NUMERIC = "tabular-nums";
