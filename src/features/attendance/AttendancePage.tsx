import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { punches } from "@/api/attendance";
import { useScopeKey } from "@/auth/session";
import { Tabs } from "@/design/Tabs";
import { Page } from "@/layout/Page";

import { DevicesTab } from "./DevicesTab";
import { MonthsTab } from "./MonthsTab";
import { RecordTab } from "./RecordTab";
import { ReportsTab } from "./ReportsTab";
import { RosterTab } from "./RosterTab";
import { TodayTab } from "./TodayTab";

type Tab = "today" | "scheduling" | "log" | "reports" | "devices" | "months";
const TABS: Tab[] = ["today", "scheduling", "log", "reports", "devices", "months"];

/** /attendance (Phase 3): today (everyone's day now), scheduling (the roster), the record, reports, devices (who
 * manages attendance) and the month lock. The header's pill: the devices' last sync. */
export default function AttendancePage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const shown = TABS;
  const asked = (params.get("tab") === "shifts" ? "today" : params.get("tab")) as Tab | null; // the old first tab
  const tab: Tab = asked && shown.includes(asked) ? asked : "today";
  const setTab = (next: Tab) => setParams(next === "today" ? {} : { tab: next }, { replace: true });
  const health = useQuery({ queryKey: ["attendance-health", ...useScopeKey()], queryFn: punches.health, refetchInterval: 60_000 });

  return (
    <Page
      title={t("attendance.title")}
      tabs={<Tabs label={t("attendance.title")} value={tab} onChange={setTab} items={shown.map((id) => ({ id, label: t(`attendance.tabs.${id}`) }))} />}
      actions={
        health.data &&
        health.data.connectors > 0 && (
          <p role="status" className="num flex h-11 items-center gap-2.5 rounded-full bg-white px-5 text-sm text-muted">
            <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${health.data.offline.length ? "bg-danger" : "bg-green-600"}`} />
            {health.data.last_sync_minutes === null
              ? t("attendance.neverSynced")
              : t("attendance.lastSync", { ago: t("common.minutesAgo", { count: health.data.last_sync_minutes }) })}
            {health.data.offline.length > 0 && ` · ${t("attendance.offlineCount", { count: health.data.offline.length })}`}
          </p>
        )
      }
    >
      {tab === "today" && <TodayTab />}
      {tab === "scheduling" && <RosterTab />}
      {tab === "log" && <RecordTab />}
      {tab === "reports" && <ReportsTab />}
      {tab === "devices" && <DevicesTab />}
      {tab === "months" && <MonthsTab />}
    </Page>
  );
}
