import { createElement } from "react";

import { leaveTypeIcon } from "@/constants/leave/leave-type-presentation";

type LeaveTypeIconProps = {
  /** The leave type's name, as configured in the database. */
  name: string | null | undefined;
  className?: string;
};

/**
 * The icon for a leave type, resolved from its name.
 *
 * Built with `createElement` rather than assigning the resolved icon to a
 * capitalised variable: binding a component to a local during render makes
 * React see a new component type whenever the name changes, so it unmounts and
 * remounts the icon instead of updating it.
 */
export function LeaveTypeIcon({ name, className }: LeaveTypeIconProps) {
  return createElement(leaveTypeIcon(name), { className, "aria-hidden": true });
}
