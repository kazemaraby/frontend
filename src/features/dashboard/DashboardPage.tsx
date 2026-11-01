import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { dashboard } from "@/api/dashboard";
import { displayName, useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { NewRequestMenu } from "@/features/selfservice/composer";
import { AnnouncementsWidget } from "@/features/announcements/AnnouncementsWidget";
import { Page } from "@/layout/Page";
import { parseDate } from "@/lib/format";

import { Events } from "./Events";
import { LeaveBalances } from "./LeaveBalances";
import { Birthdays, WhoIsAway } from "./PeopleLists";
import { QuickActions } from "./QuickActions";
import { TodayAttendance } from "./TodayAttendance";

/** / — the employee dashboard (#55): greeting, leave balances, what waits for the user and quick requests, today's
 * attendance (Phase 3), colleagues away, birthdays and the events calendar. Data: GET /dashboard and /calendar. */
export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { me, hasModule } = useSession();
  const scope = useScopeKey();
  const data = useQuery({ queryKey: ["dashboard", ...scope], queryFn: dashboard.get });
  const firstName = me ? displayName(me, i18n.language).split(" ")[0] : "";
  const d = data.data;

  return (
    <Page title={t("dashboard.greeting", { name: firstName })} actions={<NewRequestMenu />}>
      {data.isError && <Alert>{t("common.loadFailed")}</Alert>}
      {d && (
        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
          <div className="flex flex-col gap-5">
            {d.employee && hasModule("leave") && <LeaveBalances balances={d.balances} />}
            <QuickActions counts={d.counts} />
            {hasModule("attendance") && <TodayAttendance />}
          </div>
          <div className="flex flex-col gap-5">
            <AnnouncementsWidget />
            <WhoIsAway entries={d.away} />
            <Birthdays people={d.birthdays} />
          </div>
          <div className="md:col-span-2 xl:col-span-1">
            <Events today={parseDate(d.today)} />
          </div>
        </div>
      )}
    </Page>
  );
}
