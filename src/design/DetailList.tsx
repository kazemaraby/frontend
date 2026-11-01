import type { ReactNode } from "react";

import { cn } from "./cn";

export type Detail = { label: string; value: ReactNode; wide?: boolean };

/** Read-only label / value pairs of a record (employee file sections). Empty values show a dash. */
export function DetailList({ items, className }: { items: Detail[]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((item) => (
        <div key={item.label} className={cn("min-w-0", item.wide && "sm:col-span-2 lg:col-span-3")}>
          <dt className="text-xs font-medium text-muted">{item.label}</dt>
          <dd className="num mt-1 break-words text-[15px] text-ink">
            {item.value === null || item.value === undefined || item.value === "" ? "—" : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
