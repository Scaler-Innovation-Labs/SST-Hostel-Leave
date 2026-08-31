import * as React from "react";

import { Input as SstInput } from "@/design-system/sst";

/**
 * Kept as a re-export so existing `@/components/ui/input` call sites keep
 * working; the implementation is the design system's.
 */
const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>((props, ref) => <SstInput ref={ref} {...props} />);

Input.displayName = "Input";

export { Input };
