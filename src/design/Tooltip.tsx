import type { ReactNode } from "react";

import { cn } from "./cn";

type Props = {
  label: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "start";
  className?: string;
};

/** Dark tooltip on hover and keyboard focus. The trigger keeps its own aria-label; this is visual only. */
export function Tooltip({ label, children, side = "top", className }: Props) {
  return (
    <span className={cn("group/tip relative inline-flex", className)}>
      {children}
      <span
        aria-hidden="true"
        className={cn(
          // display:none until shown: an invisible tooltip near the screen edge would still widen the page.
          "pointer-events-none absolute z-40 hidden w-max max-w-56 rounded-lg bg-navy px-2.5 py-1.5 text-xs font-medium text-white shadow-pop",
          "group-hover/tip:block group-focus-within/tip:block",
          side === "top" && "inset-x-0 bottom-full mx-auto mb-2",
          side === "bottom" && "inset-x-0 top-full mx-auto mt-2",
          side === "start" && "end-full top-1/2 me-3 -translate-y-1/2",
        )}
      >
        {label}
      </span>
    </span>
  );
}
