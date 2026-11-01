import { GripVertical } from "lucide-react";
import { type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "./cn";

type Props = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  /** panel = large translucent container (radius 28); solid = white card (radius 20); inset = white block inside a panel. */
  variant?: "panel" | "solid" | "inset";
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Link or button at the end of the title row ("عرض الكل"). */
  action?: ReactNode;
  /** Shows the ⋮⋮ handle used on report widgets. */
  draggable?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
};

const variants = {
  panel: "rounded-panel border border-white/80 bg-white/55 shadow-soft backdrop-blur-sm",
  solid: "rounded-panel bg-white shadow-soft",
  inset: "rounded-card bg-white",
};

const paddings = { none: "", sm: "p-4", md: "p-5", lg: "p-5 sm:p-6" };

export function Card({
  variant = "panel",
  title,
  subtitle,
  action,
  draggable,
  padding = "lg",
  className,
  children,
  ...rest
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const hasHeader = title || action || draggable;
  // A titled card is a region named by its title (screen readers list it; tests find it by name).
  const named = title && !rest["aria-label"] && !rest["aria-labelledby"] ? { "aria-labelledby": titleId } : {};
  return (
    <section className={cn(variants[variant], paddings[padding], className)} {...named} {...rest}>
      {hasHeader && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-48 flex-1">
            {title && (
              <h2 id={titleId} className="text-lg font-semibold leading-tight text-ink sm:text-xl">
                {title}
              </h2>
            )}
            {subtitle && <p className="num mt-1.5 text-sm text-muted">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {action}
            {draggable && (
              <button
                type="button"
                aria-label={t("common.dragToMove")}
                className="-mt-1 -me-2 cursor-grab rounded-md p-1 text-subtle hover:text-muted"
              >
                <GripVertical className="size-4" />
              </button>
            )}
          </div>
        </header>
      )}
      {children}
    </section>
  );
}

/** Teal text link used in card headers ("عرض الكل", "اطلب مغادرة"). */
export function CardLink({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn("cursor-pointer text-sm font-semibold text-teal-dark hover:underline", className)}
      {...rest}
    />
  );
}
