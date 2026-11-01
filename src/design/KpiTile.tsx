import type { ReactNode } from "react";

import { cn } from "./cn";

const tones = {
  default: "text-ink",
  green: "text-green-800",
  amber: "text-amber-800",
  red: "text-danger",
  violet: "text-violet-800",
  teal: "text-teal-dark",
} as const;

type Props = {
  label: ReactNode;
  /** Number, <Money>, or a <StatusChip> for state tiles. */
  value: ReactNode;
  tone?: keyof typeof tones;
  hint?: ReactNode;
  className?: string;
};

export function KpiTile({ label, value, tone = "default", hint, className }: Props) {
  return (
    <div className={cn("flex min-h-[88px] flex-col justify-between gap-3 rounded-panel bg-white px-6 py-5 shadow-soft", className)}>
      <p className="num text-sm text-muted">{label}</p>
      <div className={cn("num text-[28px] font-bold leading-none", tones[tone])}>{value}</div>
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}
