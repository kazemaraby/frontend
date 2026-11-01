import { type ReactNode, useEffect, useId, useRef, useState } from "react";

import { cn } from "./cn";

type TriggerProps = {
  "aria-expanded": boolean;
  "aria-controls": string;
  "aria-haspopup": true;
  onClick: () => void;
};

type Props = {
  trigger: (props: TriggerProps) => ReactNode;
  children: (close: () => void) => ReactNode;
  /** Which edge of the trigger the panel lines up with. */
  align?: "start" | "end";
  className?: string;
};

/** Click-to-open popover. Closes on outside click, Escape (focus returns to the trigger) or when a child calls close(). */
export function Menu({ trigger, children, align = "start", className }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      root.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      {trigger({ "aria-expanded": open, "aria-controls": id, "aria-haspopup": true, onClick: () => setOpen((o) => !o) })}
      {open && (
        <div
          id={id}
          className={cn(
            "absolute top-full z-50 mt-2 min-w-60 rounded-card border border-line bg-white p-2 shadow-pop",
            align === "start" ? "start-0" : "end-0",
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children,
  onSelect,
  active,
  disabled,
  icon,
}: {
  children: ReactNode;
  onSelect?: () => void;
  active?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-current={active || undefined}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-start text-[15px] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        active ? "bg-teal-soft font-semibold text-teal-ink" : "text-ink hover:bg-neutral-soft",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}
