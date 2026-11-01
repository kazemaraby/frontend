import { useQuery } from "@tanstack/react-query";
import { Layers, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { type DashboardPeriod, exportsApi, type HrDashboard, type NitaqatBand, reportsApi } from "@/api/reports";
import { useScopeKey, useSession } from "@/auth/session";
import { BarChart } from "@/design/BarChart";
import { IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { DonutGauge } from "@/design/DonutGauge";
import { Money } from "@/design/Money";
import { Tabs } from "@/design/Tabs";
import { TrendChart } from "@/design/TrendChart";
import NoAccess from "@/features/misc/NoAccessPage";
import { Page } from "@/layout/Page";
import { useFormat } from "@/lib/useFormat";

import { BuilderCard } from "./Builder";
import { ExportButtons } from "./ExportButtons";
import { LeadershipBoard } from "./Leadership";
import { SchedulesCard } from "./Schedules";

type Board = "leadership" | "performance" | "builder" | "schedules";
const BANDS: Record<Exclude<NitaqatBand, "">, string> = { platinum: "platinum", high_green: "highGreen", medium_green: "midGreen", low_green: "lowGreen", red: "red" };

function Stat({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" }) {
  return (
    <div className="rounded-card bg-white px-4 py-4 text-center">
      <p className="text-sm text-muted">{label}</p>
      <p className={`num mt-1.5 text-xl font-bold ${tone === "green" ? "text-green-800" : tone === "red" ? "text-danger" : "text-ink"}`}>{value}</p>
    </div>
  );
}

/** Counts: 0 and four even whole steps of 1, 2 or 5 × 10ⁿ reaching the largest value. */
function niceTicks(max: number): number[] {
  const raw = Math.max(max, 4) / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  return [0, 1, 2, 3, 4].map((i) => i * step);
}

const PERCENT_TICKS = [0, 25, 50, 75, 100];

/** /reports — the HR dashboard (task 15, #129): real figures within the user's data scope, in the active company and
 * branch (apps/reports/dashboard.py). The period applies to every card; "default" is each card's own period. */
export default function ReportsPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const scope = useScopeKey();
  const [period, setPeriod] = useState<DashboardPeriod>("default");
  const boards: Board[] = [
    ...(can("reports.view_leadership") ? (["leadership"] as Board[]) : []),
    ...(can("reports.view") ? (["performance"] as Board[]) : []),
    ...(can("reports.build") ? (["builder"] as Board[]) : []),
    ...(can("reports.schedule") ? (["schedules"] as Board[]) : []),
  ];
  const [params, setParams] = useSearchParams();
  const chosen = params.get("tab") as Board | null;
  const setBoard = (next: Board) => setParams(next === "performance" ? {} : { tab: next }, { replace: true });
  const shown = chosen && boards.includes(chosen) ? chosen : boards.includes("performance") ? "performance" : boards[0];
  const board = useQuery({ queryKey: ["hr-dashboard", period, ...scope], queryFn: () => reportsApi.hrDashboard(period), enabled: shown === "performance" });
  if (!shown) return <NoAccess />;
  return (
    <Page
      title={t("reports.title")}
      tabs={
        <>
          <Tabs label={t("reports.title")} value={shown} onChange={setBoard} items={boards.map((id) => ({ id, label: t(`reports.tabs.${id}`) }))} />
          <IconButton variant="outline" label={t("reports.addWidget")} icon={<Plus />} />
          <IconButton variant="outline" label={t("reports.layouts")} icon={<Layers />} />
        </>
      }
      actions={
        (shown === "leadership" || shown === "performance") && <ExportButtons download={(as) => exportsApi.run(shown === "leadership" ? "leadership" : "hr_dashboard", as, { period })} />
      }
      toolbar={
        (shown === "leadership" || shown === "performance") && <Tabs
          variant="segmented"
          label={t("reports.period")}
          value={period}
          onChange={setPeriod}
          className="self-start"
          items={[
            { id: "default", label: t("reports.periods.default") },
            { id: "today", label: t("common.today") },
            { id: "d7", label: t("reports.lastDays", { count: 7 }) },
            { id: "d30", label: t("reports.lastDays", { count: 30 }) },
            { id: "m3", label: t("reports.lastMonths", { count: 3 }) },
          ]}
        />
      }
    >
      {shown === "schedules" ? (
        <SchedulesCard />
      ) : shown === "builder" ? (
        <BuilderCard />
      ) : shown === "leadership" ? (
        <LeadershipBoard period={period} />
      ) : board.isError ? (
        <Card>
          <p className="text-danger">{t("reports.loadFailed")}</p>
        </Card>
      ) : board.data ? (
        <Board data={board.data} />
      ) : (
        <Card>
          <p className="text-muted">{t("common.loading")}</p>
        </Card>
      )}
    </Page>
  );
}

function Board({ data }: { data: HrDashboard }) {
  const { t } = useTranslation();
  const format = useFormat();
  const months = format.months();
  const monthOf = (iso: string) => months[Number(iso.slice(5, 7)) - 1];
  const custom = data.period.key !== "default";
  const periodLabel = format.dateRange(data.period.first, data.period.last);
  const threeMonths = custom ? periodLabel : t("reports.lastMonths", { count: 3 });
  const covered = data.period.months;
  const monthsLabel = covered.first.slice(0, 7) === covered.last.slice(0, 7) ? format.date(covered.first, "monthYear") : `${monthOf(covered.first)} – ${format.date(covered.last, "monthYear")}`;
  const monthlyLabel = custom ? monthsLabel : threeMonths; // whole months: what the monthly figures cover

  const hires = data.hires.months;
  const peak = hires.reduce((best, m, i) => (m.count > (hires[best]?.count ?? -1) ? i : best), 0);
  const leave = data.leave;
  const workforce = data.workforce;
  const cost = workforce.payroll_cost[0];
  const nitaqat = workforce.nitaqat;
  const points = data.turnover.points;
  const monthly = points.length > 1 && points[0].start.slice(8) === "01" && points[1]?.start.slice(8) === "01";
  const trendValues = points.flatMap((p) => [Number(p.turnover ?? 0), Number(p.retention ?? 0)]);

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Card draggable title={t("reports.newHires")} subtitle={custom ? periodLabel : data.hires.first.slice(0, 4)}>
        <div className="rounded-card bg-white p-4 sm:p-5">
          <BarChart
            label={t("reports.newHiresSummary", { month: monthOf(hires[peak]?.month ?? data.hires.first), count: hires[peak]?.count ?? 0 })}
            data={hires.map((m) => ({ label: monthOf(m.month), value: m.count }))}
            highlight={hires[peak]?.count ? peak : undefined}
            ticks={niceTicks(Math.max(...hires.map((m) => m.count), 0))}
            valueLabel={(v) => t("reports.hiresCount", { count: v })}
          />
        </div>
      </Card>

      <Card draggable title={t("reports.leaveUsage")} subtitle={monthlyLabel}>
        <div className="grid grid-cols-1 gap-8 rounded-card bg-white px-5 py-8 sm:grid-cols-2">
          <figure className="flex flex-col items-center text-center">
            <DonutGauge value={Number(leave.utilisation ?? 0)} label={`${t("reports.utilisation")}: ${leave.utilisation === null ? "—" : `${format.number(leave.utilisation, [0, 1])}%`}`}>
              <span className="num text-[28px] font-bold text-ink">{leave.utilisation === null ? "—" : `${format.number(leave.utilisation, [0, 1])}%`}</span>
            </DonutGauge>
            <figcaption className="mt-4">
              <p className="text-muted">{t("reports.utilisation")}</p>
              <p className="num mt-2 text-sm font-semibold text-ink">{t("reports.takenOfEarned", { taken: format.number(leave.taken, [0, 1]), earned: format.number(leave.earned, [0, 1]) })}</p>
            </figcaption>
          </figure>
          <figure className="flex flex-col items-center text-center">
            <DonutGauge tone="tealDark" value={Number(leave.used_full_balance ?? 0)} label={`${t("reports.usedFullBalance")}: ${leave.used_full_balance === null ? "—" : `${format.number(leave.used_full_balance, [0, 1])}%`}`} />
            <figcaption className="mt-4">
              <p className="text-muted">{t("reports.usedFullBalance")}</p>
            </figcaption>
          </figure>
          <div className="flex flex-col items-center gap-1 text-center sm:col-span-2">
            <p className="text-muted">{t("reports.permissionHours")}</p>
            <p className="num text-xl font-bold text-ink">{t("reports.hours", { count: Number(leave.permission_hours) })}</p>
            {leave.average_daily_hours !== null && <p className="num text-sm text-ink">{t("reports.averageDaily", { value: t("reports.hours", { count: Number(leave.average_daily_hours) }) })}</p>}
            {leave.peak && <p className="num text-sm text-muted">{t("reports.peakMonth", { month: monthOf(leave.peak.month), hours: t("reports.hours", { count: Number(leave.peak.hours) }) })}</p>}
          </div>
        </div>
      </Card>

      <Card draggable title={t("reports.workforceCost")} subtitle={monthlyLabel}>
        <div className="flex flex-col gap-3">
          <div className="flex min-h-24 flex-col items-center justify-center rounded-[40px] bg-white px-4 py-5">
            {cost && cost.total !== null ? (
              <Money amount={cost.total} currency={cost.currency} className="text-[28px] font-bold text-ink sm:text-[36px]" signClassName="text-muted" />
            ) : (
              <>
                <span className="num text-[28px] font-bold text-ink sm:text-[36px]">—</span>
                <span className="text-sm text-muted">{cost ? t("reports.costHidden") : t("reports.noPayroll")}</span>
              </>
            )}
          </div>
          <div className="flex min-h-24 items-baseline justify-center gap-2 rounded-[40px] bg-white px-4 py-6">
            <span className="num text-[28px] font-bold text-ink sm:text-[36px]">{format.number(workforce.active)}</span>
            <span className="text-lg text-muted">{t("reports.activeEmployees", { count: workforce.active })}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label={t("reports.saudization")} value={nitaqat?.percent ? `${format.number(nitaqat.percent, [0, 1])}%` : "—"} />
            <Stat label={t("reports.nitaqatBand")} value={nitaqat?.band ? t(`reports.nitaqat.${BANDS[nitaqat.band]}`) : "—"} tone={nitaqat?.band === "red" ? "red" : "green"} />
            <Stat label={t("reports.iqamasExpiring", { count: workforce.iqama_days })} value={format.number(workforce.iqamas_expiring)} tone={workforce.iqamas_expiring ? "red" : undefined} />
          </div>
        </div>
      </Card>

      <Card draggable title={t("reports.turnoverTrends")} subtitle={threeMonths}>
        <div className="rounded-card bg-white p-4 sm:p-5">
          <TrendChart
            label={t("reports.trendSummary", {
              turnover: data.turnover.turnover === null ? "—" : `${format.number(data.turnover.turnover, [0, 1])}%`,
              retention: data.turnover.retention === null ? "—" : `${format.number(data.turnover.retention, [0, 1])}%`,
            })}
            primaryLabel={t("reports.retention")}
            secondaryLabel={t("reports.turnover")}
            data={points.map((p) => ({ label: monthly ? monthOf(p.start) : format.date(p.start, "dayMonth"), primary: Number(p.retention ?? 0), secondary: Number(p.turnover ?? 0) }))}
            ticks={Math.max(...trendValues, 0) <= 100 ? PERCENT_TICKS : niceTicks(Math.max(...trendValues))}
            height={280}
          />
          <p className="num mt-3 text-sm text-muted">{t("reports.separations", { count: data.turnover.separations, voluntary: data.turnover.voluntary, hires: data.turnover.hires })}</p>
        </div>
      </Card>
    </div>
  );
}
