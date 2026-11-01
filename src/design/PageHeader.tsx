import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  /** Shown before the title on small screens (the logo, when the rail is hidden). */
  leading?: ReactNode;
  /** End of the title row: the top bar. */
  aside?: ReactNode;
  /** Pill tabs (and any round buttons next to them). */
  tabs?: ReactNode;
  /** End of the tabs row: page actions. */
  actions?: ReactNode;
  /** Extra row under the tabs (e.g. the period picker on Reports). */
  children?: ReactNode;
};

/** Large title on the start side; segmented pill tabs below it; actions on the end side. */
export function PageHeader({ title, leading, aside, tabs, actions, children }: Props) {
  return (
    <header className="mb-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-center gap-3">
          {leading}
          <h1 className="truncate text-[26px] font-bold leading-tight text-ink sm:text-[34px]">{title}</h1>
        </div>
        {aside}
      </div>
      {(tabs || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 max-w-full items-center gap-2.5">{tabs}</div>
          {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
        </div>
      )}
      {children}
    </header>
  );
}
