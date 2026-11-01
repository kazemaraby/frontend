import { useQuery } from "@tanstack/react-query";
import { CalendarCog, ChevronLeft, ChevronRight, Clock, MapPin, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";

import { calendar, type CompanyEvent, type Holiday, type Weekday } from "@/api/calendar";
import { useScopeKey, useSession } from "@/auth/session";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { cn } from "@/design/cn";
import { Select } from "@/design/Field";
import { Pill } from "@/design/Pill";
import { Page } from "@/layout/Page";
import { sameDay, toISODate } from "@/lib/format";
import { useFormat } from "@/lib/useFormat";

import { EventRsvp } from "@/features/announcements/EventRsvp";

import { EventDialog } from "./EventDialog";

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const iso = (d: Date) => toISODate(d);
const isoWeekday = (d: Date) => (d.getDay() || 7) as Weekday; // Sunday = 7, as the backend counts

/** The 6-week grid around a month, Sunday first (the Saudi work week). */
function gridOf(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

const covers = (item: { start_date: string; end_date: string }, day: string) => item.start_date <= day && day <= item.end_date;

/** /calendar — the month for one branch: weekend, public holidays (Gregorian with the Hijri day) and company events.
 * HR adds events here; holidays and the work week are set in /settings/holidays. */
export default function CalendarPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { company, branch: activeBranch, can } = useSession();
  const [params, setParams] = useSearchParams();
  const today = new Date();
  const monthParam = params.get("month"); // YYYY-MM
  const month = monthParam ? new Date(Number(monthParam.slice(0, 4)), Number(monthParam.slice(5, 7)) - 1, 1) : new Date(today.getFullYear(), today.getMonth(), 1);
  const [branch, setBranch] = useState<string>(activeBranch ? String(activeBranch.id) : "");
  const [selected, setSelected] = useState<string>(iso(today));
  const [dialog, setDialog] = useState<{ event?: CompanyEvent; day?: string } | null>(null);

  const cells = gridOf(month);
  const from = iso(cells[0]);
  const to = iso(cells[cells.length - 1]);
  const data = useQuery({
    queryKey: ["calendar", from, to, branch, ...scope],
    queryFn: () => calendar.month(from, to, branch ? Number(branch) : null),
    placeholderData: (previous) => previous,
  });
  const weekend = new Set<Weekday>(data.data?.weekend_days ?? []);
  const holidays = data.data?.holidays ?? [];
  const events = data.data?.events ?? [];
  const manageEvents = can("leave.manage_events");

  const go = (delta: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setParams({ month: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}` }, { replace: true });
  };
  const Prev = format.dir === "rtl" ? ChevronRight : ChevronLeft;
  const Next = format.dir === "rtl" ? ChevronLeft : ChevronRight;
  const title = (e: CompanyEvent) => format.pick({ ar: e.title_ar, en: e.title_en });
  const name = (h: Holiday) => format.name(h);
  const time = (e: CompanyEvent) =>
    e.all_day ? t("calendar.events.allDay") : e.end_time ? format.timeRange(e.start_time!, e.end_time) : format.time(e.start_time!);

  const dayHolidays = holidays.filter((h) => covers(h, selected));
  const dayEvents = events.filter((e) => covers(e, selected));
  const inMonth = (d: string) => d.slice(0, 7) === iso(month).slice(0, 7);
  const monthHolidays = holidays.filter((h) => inMonth(h.start_date) || inMonth(h.end_date));
  const hijriSpan = [format.hijriMonth(new Date(month.getFullYear(), month.getMonth(), 1)), format.hijriMonth(new Date(month.getFullYear(), month.getMonth() + 1, 0))];

  return (
    <Page
      title={t("calendar.title")}
      actions={
        <>
          {can("leave.manage_calendar") && (
            <Link to="/settings/holidays" className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-white px-5 text-[15px] text-ink hover:bg-neutral-soft">
              <CalendarCog aria-hidden="true" className="size-[18px]" />
              {t("calendar.manageHolidays")}
            </Link>
          )}
          {manageEvents && (
            <Button variant="accent" icon={<Plus className="size-[18px]" />} onClick={() => setDialog({ day: selected })}>
              {t("calendar.events.new")}
            </Button>
          )}
        </>
      }
      toolbar={
        <div className="flex flex-wrap items-center gap-3">
          <IconButton size="sm" variant="soft" label={t("calendar.previousMonth")} icon={<Prev />} onClick={() => go(-1)} tooltip={false} />
          <h2 className="num min-w-44 text-center text-lg font-semibold" aria-live="polite">
            {format.date(month, "monthYear")}
            <span className="block text-xs font-normal text-muted">{hijriSpan[0] === hijriSpan[1] ? hijriSpan[0] : hijriSpan.join(" – ")}</span>
          </h2>
          <IconButton size="sm" variant="soft" label={t("calendar.nextMonth")} icon={<Next />} onClick={() => go(1)} tooltip={false} />
          <Button size="sm" variant="outline" onClick={() => { setParams({}, { replace: true }); setSelected(iso(today)); }}>
            {t("common.today")}
          </Button>
          {(company?.branches.length ?? 0) > 1 && (
            <Select
              label={t("employee.fields.branch")}
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              options={[{ value: "", label: t("calendar.myBranch") }, ...(company?.branches ?? []).map((b) => ({ value: String(b.id), label: format.name(b) }))]}
              className="min-w-48"
            />
          )}
          {data.data && (
            <span className="num text-sm text-muted">
              {t("calendar.workingDays", { count: cells.filter((d) => inMonth(iso(d)) && !weekend.has(isoWeekday(d)) && !holidays.some((h) => covers(h, iso(d)))).length })}
            </span>
          )}
        </div>
      }
    >
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card variant="solid" padding="sm">
          <div role="grid" aria-label={format.date(month, "monthYear")} className="grid grid-cols-7 gap-1">
            <div role="row" className="contents">
              {WEEKDAYS.map((day) => (
                <div key={day} role="columnheader" className="py-2 text-center text-sm text-muted">
                  {t(`calendar.weekdays.${day}`)}
                </div>
              ))}
            </div>
            {Array.from({ length: 6 }, (_, week) => (
              <div key={week} role="row" className="contents">
                {cells.slice(week * 7, week * 7 + 7).map((day) => {
                  const key = iso(day);
                  const off = weekend.has(isoWeekday(day));
                  const hs = holidays.filter((h) => covers(h, key));
                  const es = events.filter((e) => covers(e, key));
                  return (
                    <div key={key} role="gridcell" aria-selected={selected === key}>
                      <button
                        type="button"
                        onClick={() => setSelected(key)}
                        aria-label={[format.date(day), format.hijri(day), ...hs.map(name), ...es.map(title)].join(t("common.listSeparator"))}
                        aria-current={sameDay(day, today) ? "date" : undefined}
                        className={cn(
                          "flex h-full min-h-16 w-full cursor-pointer flex-col items-stretch gap-1 rounded-tile p-1.5 text-start transition-colors sm:min-h-24",
                          hs.length ? "bg-pink-50" : off ? "bg-neutral-soft" : "bg-white hover:bg-teal-mist",
                          !inMonth(key) && "opacity-45",
                          selected === key && "ring-2 ring-navy",
                        )}
                      >
                        <span className="flex items-center justify-between gap-1">
                          <span
                            className={cn(
                              "num flex size-7 items-center justify-center rounded-full text-sm",
                              sameDay(day, today) ? "bg-teal-dark font-semibold text-white" : "text-ink",
                            )}
                          >
                            {format.number(day.getDate())}
                          </span>
                          <span className="num text-[11px] text-subtle">{format.hijriDay(day)}</span>
                        </span>
                        {hs.slice(0, 1).map((h) => (
                          <span key={h.id} className="hidden truncate rounded-md bg-pink-100 px-1.5 py-0.5 text-[11px] text-pink-800 sm:block">
                            {name(h)}
                          </span>
                        ))}
                        {es.slice(0, hs.length ? 1 : 2).map((e) => (
                          <span key={e.id} className="hidden truncate rounded-md bg-teal-soft px-1.5 py-0.5 text-[11px] text-teal-ink sm:block">
                            {title(e)}
                          </span>
                        ))}
                        {hs.length + es.length > 0 && (
                          <span aria-hidden="true" className="mx-auto flex gap-0.5 sm:hidden">
                            {hs.length > 0 && <span className="size-1.5 rounded-full bg-pink-500" />}
                            {es.length > 0 && <span className="size-1.5 rounded-full bg-teal-dark" />}
                          </span>
                        )}
                        {hs.length + es.length > 2 && <span className="hidden text-[11px] text-muted sm:block">+{format.number(hs.length + es.length - 2)}</span>}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="mt-3 flex flex-wrap gap-4 px-1 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded bg-neutral-soft" />{t("calendar.legend.weekend")}</span>
            <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded bg-pink-100" />{t("calendar.legend.holiday")}</span>
            <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded bg-teal-soft" />{t("calendar.legend.event")}</span>
          </p>
        </Card>

        <div className="flex flex-col gap-4">
          <Card variant="solid" title={format.date(selected, "dayMonthYear")} subtitle={format.hijri(selected)} aria-label={t("calendar.selectedDay")}>
            {dayHolidays.length + dayEvents.length === 0 ? (
              <p className="text-sm text-muted">
                {weekend.has(isoWeekday(new Date(selected))) ? t("calendar.weekendDay") : t("calendar.nothing")}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {dayHolidays.map((h) => (
                  <li key={h.id} className="rounded-tile bg-pink-50 px-3 py-2">
                    <p className="font-medium text-ink">{name(h)}</p>
                    <p className="num text-sm text-muted">
                      {format.dateRange(h.start_date, h.end_date)} · {t("calendar.days", { count: h.days })}
                    </p>
                  </li>
                ))}
                {dayEvents.map((e) => (
                  <li key={e.id} className="rounded-tile border border-line px-3 py-2">
                    <p className="flex items-start justify-between gap-2 font-medium text-ink">
                      {title(e)}
                      {e.audience !== "company" && <Pill tone="lavender">{t(`calendar.events.audiences.${e.audience}`)}</Pill>}
                    </p>
                    <p className="num mt-1 flex items-center gap-1.5 text-sm text-muted"><Clock aria-hidden="true" className="size-3.5" />{time(e)}</p>
                    {e.location && <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted"><MapPin aria-hidden="true" className="size-3.5" />{e.location}</p>}
                    {e.description && <p className="mt-1 whitespace-pre-line text-sm">{e.description}</p>}
                    <EventRsvp event={e.id} past={e.end_date < iso(today)} />
                    {manageEvents && (
                      <Button size="sm" variant="ghost" className="mt-1 -ms-3" onClick={() => setDialog({ event: e })}>
                        {t("common.edit")}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card variant="solid" title={t("calendar.holidaysThisMonth")}>
            {monthHolidays.length === 0 ? (
              <p className="text-sm text-muted">{t("calendar.noHolidays")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {monthHolidays.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{name(h)}</span>
                    <span className="num text-muted">{format.dateRange(h.start_date, h.end_date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      {dialog && <EventDialog event={dialog.event} day={dialog.day} onClose={() => setDialog(null)} />}
    </Page>
  );
}
