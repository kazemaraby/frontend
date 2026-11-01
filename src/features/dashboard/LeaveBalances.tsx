import { ArrowLeft, ArrowRight, Baby, CalendarDays, GraduationCap, Heart, Landmark, type LucideIcon, Plane, Sun, Thermometer } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Dashboard } from "@/api/dashboard";
import { IconButton } from "@/design/Button";
import { Card, CardLink } from "@/design/Card";
import { useComposer } from "@/features/selfservice/composer";
import { useFormat } from "@/lib/useFormat";

const ICONS: Record<string, LucideIcon> = {
  annual: Sun,
  sick: Thermometer,
  hajj: Landmark,
  marriage: Heart,
  maternity: Baby,
  paternity: Baby,
  exam: GraduationCap,
};
const PAGE = 4;

/** The user's balances (#55): one tile per leave type they may take, and air tickets when a policy gives them. */
export function LeaveBalances({ balances }: { balances: Dashboard["balances"] }) {
  const { t } = useTranslation();
  const format = useFormat();
  const composer = useComposer();
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(balances.length / PAGE));
  const visible = balances.slice(page * PAGE, page * PAGE + PAGE);
  const go = (delta: number) => setPage((p) => (p + delta + pages) % pages);
  const days = (v: string | null) => format.number(Number(v ?? 0), [0, 2]);

  return (
    <Card
      title={t("dashboard.leaveBalance")}
      action={composer.kinds.includes("leave") && <CardLink onClick={() => composer.open("leave")}>{t("dashboard.requestLeave")}</CardLink>}
    >
      {balances.length === 0 ? (
        <p className="rounded-card bg-white p-4 text-sm text-muted">{t("dashboard.noBalances")}</p>
      ) : (
        <div className="-mx-1 flex items-center gap-1.5 sm:-mx-2">
          <IconButton size="xs" variant="outline" label={t("common.previous")} icon={<ArrowLeft className="rtl:-scale-x-100" />} onClick={() => go(-1)} disabled={pages < 2} />
          <ul className="grid min-w-0 flex-1 grid-cols-2 gap-2.5" aria-live="polite">
            {visible.map((b) => {
              const tickets = b.kind === "tickets";
              const Icon = tickets ? Plane : (ICONS[b.leave_type!.code] ?? CalendarDays);
              const name = tickets ? t("dashboard.airTickets") : format.name(b.leave_type!);
              const per = b.kind === "occasion";
              const value = b.available ?? b.entitled;
              return (
                <li key={tickets ? "tickets" : b.leave_type!.id} className="min-h-32 rounded-card bg-white p-3.5">
                  <p className="flex items-center gap-2 text-[13px] text-muted">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-soft text-teal-dark">
                      <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 leading-snug">{name}</span>
                  </p>
                  <p className="num mt-4 flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-[26px] font-bold leading-none text-ink">{days(value)}</span>
                    <span className="text-sm text-muted">
                      {per ? t("dashboard.perOccasion") : tickets ? t("dashboard.tickets") : b.entitled ? t("dashboard.ofDays", { total: days(b.entitled) }) : ""}
                    </span>
                  </p>
                  {Number(b.pending) > 0 && <p className="num mt-1.5 text-xs text-amber-800">{t("dashboard.pendingDays", { days: days(b.pending) })}</p>}
                </li>
              );
            })}
          </ul>
          <IconButton size="xs" variant="outline" label={t("common.next")} icon={<ArrowRight className="rtl:-scale-x-100" />} onClick={() => go(1)} disabled={pages < 2} />
        </div>
      )}
    </Card>
  );
}
