import { type KeyboardEvent, type ReactNode, useRef } from "react";

import { cn } from "./cn";

export type TabItem<T extends string> = { id: T; label: ReactNode };

type Props<T extends string> = {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** pills = separate pills (page tabs); segmented = one white track (period picker). */
  variant?: "pills" | "segmented";
  label: string;
  className?: string;
};

/** Pill tabs: active = dark navy with white text, inactive = white with a thin border.
 * Arrow keys move between tabs and follow the reading direction. */
export function Tabs<T extends string>({ items, value, onChange, variant = "pills", label, className }: Props<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const index = items.findIndex((item) => item.id === value);
    const forward = event.key === (rtl ? "ArrowLeft" : "ArrowRight");
    let next = forward ? index + 1 : index - 1;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    next = (next + items.length) % items.length;
    onChange(items[next].id);
    listRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
  }

  const segmented = variant === "segmented";
  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "scrollbar-none flex max-w-full items-center overflow-x-auto",
        segmented ? "gap-1 rounded-full bg-white p-1 shadow-soft" : "gap-2.5",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              "num shrink-0 cursor-pointer whitespace-nowrap rounded-full font-medium transition-colors",
              segmented ? "h-9 px-4 text-sm sm:px-5" : "h-11 px-5 text-[15px] sm:px-6",
              active && "bg-navy text-white",
              !active && !segmented && "border border-line-strong bg-white text-ink hover:bg-neutral-soft",
              !active && segmented && "text-ink hover:bg-neutral-soft",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
