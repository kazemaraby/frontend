import { cn } from "./cn";

const tones = {
  slate: "bg-avatar text-navy",
  peach: "bg-peach text-peach-ink",
  forest: "bg-forest text-white",
  navy: "bg-navy text-white",
  teal: "bg-teal-soft text-teal-dark",
} as const;

const sizes = {
  "2xs": "size-5 text-[10px]",
  xs: "size-8 text-sm",
  sm: "size-9 text-sm",
  md: "size-11 text-base",
  lg: "size-12 text-lg",
  /** 40px on phones, 44px from sm up (top-bar account button). */
  responsive: "size-10 text-base sm:size-11",
} as const;

type Props = {
  name: string;
  tone?: keyof typeof tones;
  size?: keyof typeof sizes;
  className?: string;
};

/** Round initial avatar (photos arrive with the employee file in Phase 1). */
export function Avatar({ name, tone = "slate", size = "sm", className }: Props) {
  const initial = Array.from(name.trim())[0] ?? "?";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold",
        tones[tone],
        sizes[size],
        className,
      )}
    >
      {initial}
    </span>
  );
}
