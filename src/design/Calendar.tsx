import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { sameDay, toISODate } from "@/lib/format";
import { useFormat } from "@/lib/useFormat";

import { IconButton } from "./Button";
import { cn } from "./cn";

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

type Props = {
  today: Date;
  /** Month shown first (defaults to today's). */
  initialMonth?: Date;
  /** ISO dates that get an event dot. */
  marked?: string[];
  selected?: Date;
  onSelect?: (day: Date) => void;
  className?: string;
};

/** Month view, week starting Sunday (Saudi work week). Today = filled teal circle; event days get a dot. */
export function Calendar({ today, initialMonth, marked = [], selected, onSelect, className }: Props) {
  const { t } = useTranslation();
  const format = useFormat();
  const [month, setMonth] = useState(() => {
    const base = initialMonth ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const markedSet = new Set(marked);

  const leading = month.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];

  const shift = (delta: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  return (
    <div className={cn("rounded-card bg-white p-4 sm:p-5", className)}>
      <div className="mb-4 flex items-center justify-between">
        <IconButton
          size="sm"
          variant="soft"
          label={t("calendar.previousMonth")}
          icon={<ChevronLeft className="rtl:-scale-x-100" />}
          onClick={() => shift(-1)}
          tooltip={false}
        />
        <h3 className="num text-lg font-semibold" aria-live="polite">
          {format.date(month, "monthYear")}
        </h3>
        <IconButton
          size="sm"
          variant="soft"
          label={t("calendar.nextMonth")}
          icon={<ChevronRight className="rtl:-scale-x-100" />}
          onClick={() => shift(1)}
          tooltip={false}
        />
      </div>
      <div role="grid" aria-label={format.date(month, "monthYear")} className="grid grid-cols-7 gap-y-1 text-center">
        <div role="row" className="contents">
          {WEEKDAYS.map((day) => (
            <div key={day} role="columnheader" className="pb-2 text-sm text-muted">
              {t(`calendar.weekdays.${day}`)}
            </div>
          ))}
        </div>
        {cells.map((day, i) =>
          day === null ? (
            <div key={`pad-${i}`} role="gridcell" />
          ) : (
            <div key={day.getDate()} role="gridcell" className="flex justify-center">
              <button
                type="button"
                onClick={() => onSelect?.(day)}
                aria-label={format.date(day)}
                aria-current={sameDay(day, today) ? "date" : undefined}
                aria-pressed={selected ? sameDay(day, selected) : undefined}
                className={cn(
                  "num relative flex size-10 cursor-pointer items-center justify-center rounded-full text-[15px] transition-colors",
                  sameDay(day, today)
                    ? "bg-teal-dark font-semibold text-white"
                    : "text-ink hover:bg-neutral-soft",
                  selected && sameDay(day, selected) && !sameDay(day, today) && "ring-2 ring-navy",
                )}
              >
                {format.number(day.getDate())}
                {markedSet.has(toISODate(day)) && (
                  <span aria-hidden="true" className="absolute bottom-0.5 size-1.5 rounded-full bg-teal-dark" />
                )}
              </button>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
