import { Gift } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { AwayEntry, Dashboard } from "@/api/dashboard";
import { Avatar } from "@/design/Avatar";
import { Card } from "@/design/Card";
import { Pill, StatusChip } from "@/design/Pill";
import { useFormat } from "@/lib/useFormat";

function PersonRow({ name, detail, end }: { name: string; detail: string; end: ReactNode }) {
  return (
    <li className="flex items-center gap-3 border-b border-line py-3.5 first:pt-1 last:border-0 last:pb-1">
      <Avatar name={name} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{name}</p>
        <p className="num mt-0.5 text-sm text-muted">{detail}</p>
      </div>
      {end}
    </li>
  );
}

const CHIP = { mission: "workMission", remote: "remoteWork", trip: "outOfOffice" } as const;
const chipOf = (e: AwayEntry) => (e.kind === "leave" ? (e.category === "sick" ? "sickLeave" : "annualLeave") : CHIP[e.kind]);

/** Colleagues away today and in the coming week: leave, missions, remote work, business trips. */
export function WhoIsAway({ entries }: { entries: Dashboard["away"] }) {
  const { t } = useTranslation();
  const format = useFormat();
  return (
    <Card title={t("dashboard.whoIsAway")} subtitle={t("dashboard.nextDays")}>
      {entries.length === 0 ? (
        <p className="rounded-card bg-white p-4 text-sm text-muted">{t("dashboard.nobodyAway")}</p>
      ) : (
        <ul className="rounded-card bg-white px-5 py-3">
          {entries.map((e, i) => (
            <PersonRow key={`${e.kind}-${e.employee.id}-${i}`} name={format.name(e.employee)} detail={format.dateRange(e.start, e.end)} end={<StatusChip status={chipOf(e)} label={format.pick(e.label)} />} />
          ))}
        </ul>
      )}
    </Card>
  );
}

export function Birthdays({ people }: { people: Dashboard["birthdays"] }) {
  const { t } = useTranslation();
  const format = useFormat();
  return (
    <Card title={t("dashboard.birthdays")}>
      {people.length === 0 ? (
        <p className="rounded-card bg-white p-4 text-sm text-muted">{t("dashboard.noBirthdays")}</p>
      ) : (
        <ul className="rounded-card bg-white px-5 py-3">
          {people.map((p) => (
            <PersonRow
              key={p.employee.id}
              name={format.name(p.employee)}
              detail={t("dashboard.inDays", { count: p.in_days })}
              end={
                <Pill tone="lavender" icon={<Gift aria-hidden="true" />}>
                  {format.date(p.day, "dayMonth")}
                </Pill>
              }
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
