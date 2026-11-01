import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";
import { Tooltip } from "./Tooltip";

const variants = {
  /** Dark navy: the default primary action (CLAUDE.md). */
  primary: "bg-navy text-white hover:bg-navy-hover",
  /** Teal: "add" actions, as drawn in the Employees / Payroll / Attendance screens. */
  accent: "bg-teal-dark text-white hover:bg-teal-dark-hover",
  outline: "border border-line-strong bg-white text-ink hover:bg-neutral-soft",
  ghost: "text-ink hover:bg-white/70",
} as const;

const sizes = {
  sm: "h-9 gap-1.5 px-4 text-sm",
  md: "h-11 gap-2 px-5 text-[15px]",
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  icon?: ReactNode;
  /** The designs put the icon after the label (to its left in Arabic). */
  iconPosition?: "start" | "end";
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "end",
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {iconPosition === "start" && icon}
      {children}
      {iconPosition === "end" && icon}
    </button>
  );
}

const iconVariants = {
  /** White circle (top bar, page header). */
  surface: "bg-white text-ink hover:bg-neutral-soft",
  outline: "border border-line-strong bg-white text-ink hover:bg-neutral-soft",
  solid: "bg-navy text-white hover:bg-navy-hover",
  /** Pale grey circle (calendar arrows). */
  soft: "bg-neutral-soft text-ink hover:bg-line",
  /** Bare icon in a table row. */
  plain: "text-ink hover:bg-neutral-soft",
  /** Bare icon that turns into a light red square on hover (delete). */
  danger: "text-ink hover:bg-danger-soft hover:text-danger",
} as const;

const iconSizes = {
  xs: "size-8 [&_svg]:size-4",
  sm: "size-9 [&_svg]:size-[18px]",
  md: "size-11 [&_svg]:size-5",
} as const;

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  icon: ReactNode;
  variant?: keyof typeof iconVariants;
  size?: keyof typeof iconSizes;
  tooltip?: boolean;
  tooltipSide?: "top" | "bottom";
};

export function IconButton({
  label,
  icon,
  variant = "surface",
  size = "md",
  tooltip = true,
  tooltipSide = "top",
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  const square = variant === "plain" || variant === "danger";
  const button = (
    <button
      type={type}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        square ? "rounded-lg" : "rounded-full",
        iconVariants[variant],
        iconSizes[size],
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
  return tooltip ? (
    <Tooltip label={label} side={tooltipSide}>
      {button}
    </Tooltip>
  ) : (
    button
  );
}
