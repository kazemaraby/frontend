import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { calendar } from "@/api/calendar";
import { useScopeKey } from "@/auth/session";
import { Calendar } from "@/design/Calendar";
import { Card, CardLink } from "@/design/Card";
import { Pill } from "@/design/Pill";
import { parseDate, sameDay, toISODate } from "@/lib/format";
import { useFormat } from "@/lib/useFormat";
import { useNavigate } from "react-router";

const DAY = 24 * 60 * 60 * 1000;

function daysOf(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = parseDate(start).getTime(); d <= parseDate(end).getTime() && out.length < 60; d += DAY) out.push(toISODate(new Date(d)));
  return out;
}

/** Company events and public holidays (the work calendar, decision 15) around today; a day shows what is on. */
export function Events({ today }: { today: Date }) {
  const { t } = useTranslation();
  const format = useFormat();
  const navigate = useNavigate();
  const scope = useScopeKey();
  const [day, setDay] = useState(today);
  const from = toISODate(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const to = toISODate(new Date(today.getFullYear(), today.getMonth() + 4, 0));
  const data = useQuery({ queryKey: ["calendar", "dashboard", from, to, ...scope], queryFn: () => calendar.month(from, to) });
  const items = [
    ...(data.data?.holidays ?? []).map((h) => ({ key: `h${h.id}`, title: format.name(h), start: h.start_date, end: h.end_date, time: null as string | null, holiday: true })),
    ...(data.data?.events ?? []).map((e) => ({
      key: `e${e.id}`,
      title: format.pick({ ar: e.title_ar, en: e.title_en || e.title_ar }),
      start: e.start_date,
      end: e.end_date,
      time: e.all_day || !e.start_time ? null : format.timeRange(e.start_time.slice(0, 5), (e.end_time ?? e.start_time).slice(0, 5)),
      holiday: false,
    })),
  ];
  const iso = toISODate(day);
  const todays = items.filter((i) => i.start <= iso && i.end >= iso);
  const marked = [...new Set(items.flatMap((i) => daysOf(i.start, i.end)))].filter((d) => d !== toISODate(today));

  return (
    <Card title={t("dashboard.events")} action={<CardLink onClick={() => navigate("/calendar")}>{t("common.viewAll")}</CardLink>}>
      <Calendar today={today} marked={marked} selected={day} onSelect={setDay} />
      <h3 className="num mt-6 text-[15px] font-semibold text-teal-dark">{sameDay(day, today) ? t("common.today") : format.date(day, "dayMonth")}</h3>
      {todays.length === 0 ? (
        <p className="py-4 text-sm text-muted">{t("dashboard.noEvents")}</p>
      ) : (
        <ul>
          {todays.map((e) => (
            <li key={e.key} className="flex items-start justify-between gap-3 border-b border-line py-3.5 last:border-0">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{e.title}</p>
                <p className="num mt-1 text-sm text-muted">{e.time ?? (e.start === e.end ? t("dashboard.allDay") : format.dateRange(e.start, e.end))}</p>
              </div>
              {e.holiday && <Pill tone="teal">{t("dashboard.holiday")}</Pill>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
