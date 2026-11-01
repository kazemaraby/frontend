import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "./cn";

export const pillTones = {
  green: "bg-green-100 text-green-800",
  amber: "bg-amber-100 text-amber-800",
  navy: "bg-ink text-white", // a dark neutral: the primary green would read as "active" on a suspended chip
  pink: "bg-pink-100 text-pink-800",
  salmon: "bg-danger-soft text-danger",
  lavender: "bg-violet-100 text-violet-800",
  orange: "bg-orange-100 text-orange-800",
  sky: "bg-sky-100 text-sky-800",
  teal: "bg-teal-soft text-teal-ink",
  neutral: "bg-neutral-soft text-muted",
} as const;
export type PillTone = keyof typeof pillTones;

const pillSizes = {
  sm: "h-7 gap-1.5 px-3 text-[13px] [&_svg]:size-3.5",
  md: "h-9 gap-2 px-4 text-sm [&_svg]:size-4",
} as const;

type PillProps = {
  tone?: PillTone;
  size?: keyof typeof pillSizes;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Small pastel pill. Icons sit before the text (the gift icon on birthdays). */
export function Pill({ tone = "neutral", size = "sm", icon, className, children }: PillProps) {
  return (
    <span
      className={cn(
        "num inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold",
        pillSizes[size],
        pillTones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Every status in CLAUDE.md → its colour. Labels live under "status.*" in the i18n files. */
export const STATUS_TONES = {
  active: "green",
  pending: "amber",
  suspended: "navy",
  terminated: "pink",
  contractEnded: "salmon",
  contract_ended: "salmon", // the API's spelling (employee status)
  hired: "lavender",
  annualLeave: "pink",
  workMission: "orange",
  remoteWork: "sky",
  outOfOffice: "sky",
  sickLeave: "lavender",
  present: "green",
  late: "amber",
  absent: "salmon",
  notStarted: "neutral",
  draft: "amber",
  // Requests (approval engine)
  approved: "green",
  rejected: "salmon",
  returned: "orange",
  cancelled: "neutral",
} as const satisfies Record<string, PillTone>;
export type Status = keyof typeof STATUS_TONES;
export const STATUSES = Object.keys(STATUS_TONES) as Status[];

type StatusChipProps = {
  status: Status;
  /** Replaces the default label, e.g. "حاضر 07:56 ص". */
  label?: ReactNode;
  size?: PillProps["size"];
  className?: string;
};

export function StatusChip({ status, label, size, className }: StatusChipProps) {
  const { t } = useTranslation();
  return (
    <Pill tone={STATUS_TONES[status]} size={size} className={className}>
      {label ?? t(`status.${status}`)}
    </Pill>
  );
}
