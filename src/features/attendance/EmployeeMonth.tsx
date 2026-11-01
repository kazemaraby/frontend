import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type AttendanceDay, days } from "@/api/attendance";
import { useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { KpiTile } from "@/design/KpiTile";
import { Pill } from "@/design/Pill";
import { toISODate } from "@/lib/format";
import { useFormat } from "@/lib/useFormat";

import { hm, useClock } from "./clock";
import { DAY_TONES } from "./tones";

const AT_WORK = ["present", "late", "early_leave"];

/** One employee's attendance month (Phase 3 task 16) in their file: each day's status and times, and the month's
 * totals. The employee sees their own (/attendance-days/mine); HR and the manager by data scope. */
export function EmployeeMonth({ employeeId }: { employeeId: number }) {
  const { t } = useTranslation();
  const format = useFormat();
  const clock = useClock();
  const { me } = useSession();
  const own = me?.employee?.id === employeeId;
  const [month, setMonth] = useState(() => toISODate(new Date()).slice(0, 7));
  const first = new Date(`${month}-01T00:00:00`);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const from = `${month}-01`;
  const to = toISODate(last);
  const list = useQuery({
    queryKey: ["attendance-days", "month", employeeId, month],
    queryFn: async () => (own ? days.mine(from, to) : (await days.list({ employee: employeeId, from, to, page_size: 31 })).results),
  });
  const byDate = new Map((list.data ?? []).map((d) => [d.date, d]));
  const move = (step: number) => {
    const next = new Date(first.getFullYear(), first.getMonth() + step, 1);
    setMonth(toISODate(next).slice(0, 7));
  };
  const rows = list.data ?? [];
  const total = (pick: (d: AttendanceDay) => number) => rows.reduce((sum, d) => sum + pick(d), 0);
  const cells: (Date | null)[] = [...Array(first.getDay()).fill(null)];
  for (let d = 1; d <= last.getDate(); d += 1) cells.push(new Date(first.getFullYear(), first.getMonth(), d));
  const title = `${format.months()[first.getMonth()]} ${first.getFullYear()}`;
  const weekdays = Array.from({ length: 7 }, (_, i) => format.date(toISODate(new Date(2026, 9, 18 + i)), "weekday"));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiTile label={t("employeeMonth.present")} value={format.number(rows.filter((d) => AT_WORK.includes(d.status)).length)} tone="green" />
        <KpiTile label={t("employeeMonth.absent")} value={format.number(rows.filter((d) => d.status === "absent" || d.status === "incomplete").length)} tone="red" />
        <KpiTile label={t("employeeMonth.late")} value={hm(total((d) => d.late_minutes))} tone="amber" />
        <KpiTile label={t("employeeMonth.worked")} value={hm(total((d) => d.worked_minutes))} />
      </div>
      <Card
        variant="solid"
        title={t("employeeMonth.title")}
        subtitle={t("employeeMonth.hint")}
        action={
          <div className="flex items-center gap-1">
            <IconButton size="sm" variant="plain" label={t("employeeMonth.previous")} icon={<ChevronRight className="ltr:rotate-180" />} onClick={() => move(-1)} />
            <span className="num min-w-32 text-center font-semibold">{title}</span>
            <IconButton size="sm" variant="plain" label={t("employeeMonth.next")} icon={<ChevronLeft className="ltr:rotate-180" />} onClick={() => move(1)} />
          </div>
        }
      >
        {list.isError && <Alert>{t("common.loadFailed")}</Alert>}
        <div role="grid" aria-label={title} className="grid grid-cols-7 gap-2">
          {weekdays.map((w) => (
            <div key={w} role="columnheader" className="pb-1 text-center text-xs font-medium text-muted">
              {w}
            </div>
          ))}
          {cells.map((day, i) => {
            if (!day) return <div key={`blank-${i}`} aria-hidden="true" />;
            const iso = toISODate(day);
            const d = byDate.get(iso);
            const label = d ? (d.covers[0] && ["leave", "mission", "trip", "remote"].includes(d.status) ? format.pick(d.covers[0].label) : t(`record.status.${d.status}`)) : "";
            return (
              <div key={iso} role="gridcell" aria-label={`${format.date(iso, "dayMonthYear")}${label ? ` · ${label}` : ""}`} className="flex min-h-20 flex-col gap-1 rounded-card bg-white p-2">
                <span className="num text-sm font-semibold text-ink">{day.getDate()}</span>
                {d && (
                  <>
                    <Pill tone={DAY_TONES[d.status]} className="self-start text-[11px]">
                      {label}
                    </Pill>
                    {(d.first_in || d.last_out) && (
                      <span dir="ltr" className="num text-[11px] text-muted">
                        {clock(d.first_in, d.time_zone)}–{clock(d.last_out, d.time_zone)}
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
