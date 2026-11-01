import type { ReactNode } from "react";

import { cn } from "./cn";

const tones = {
  danger: "bg-danger-soft text-danger",
  info: "bg-teal-soft text-teal-ink",
  warning: "bg-amber-100 text-amber-800",
} as const;

/** Inline message block (form errors, notes). Errors are announced to screen readers. */
export function Alert({ tone = "danger", className, children }: { tone?: keyof typeof tones; className?: string; children: ReactNode }) {
  return (
    <p role={tone === "danger" ? "alert" : "status"} className={cn("rounded-card px-4 py-3 text-sm", tones[tone], className)}>
      {children}
    </p>
  );
}
