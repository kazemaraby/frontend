import type { ReactNode } from "react";

import { cn } from "./cn";

type Props = {
  /** 0–100. */
  value: number;
  /** Accessible description, e.g. "90% used their full balance". */
  label: string;
  tone?: "teal" | "tealDark";
  size?: number;
  thickness?: number;
  /** Centre content; defaults to "{value}%". */
  children?: ReactNode;
  className?: string;
};

/** Teal ring gauge with the value in the centre. Starts at 12 o'clock and runs clockwise. */
export function DonutGauge({ value, label, tone = "teal", size = 128, thickness = 14, children, className }: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - thickness) / 2;
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} className="stroke-teal-soft" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${clamped} 100`}
          className={tone === "teal" ? "stroke-teal" : "stroke-teal-dark"}
        />
      </svg>
      <div aria-hidden="true" className="num absolute inset-0 grid place-items-center text-center">
        {children ?? <span className="text-[28px] font-bold text-ink">{clamped}%</span>}
      </div>
    </div>
  );
}
