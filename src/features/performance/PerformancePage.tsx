import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { useSession } from "@/auth/session";
import { Card } from "@/design/Card";
import { Pill } from "@/design/Pill";
import { Tabs } from "@/design/Tabs";
import NoAccess from "@/features/misc/NoAccessPage";
import { Page } from "@/layout/Page";
import { useFormat } from "@/lib/useFormat";

import { Calibration, MyAppraisal, Reviews } from "./Appraisals";
import { CompensationCard } from "./Compensation";
import { CyclePicker, DepartmentGoalsCard, GoalSheetCard, TeamGoals, useCycles } from "./Goals";
import { PipsCard } from "./Pips";
import { ProbationCard } from "./Probation";
import { CompetenciesCard, CyclesCard, ScalesCard, TemplatesCard } from "./SetupCards";

type Section = "cycles" | "templates" | "competencies" | "scales";
type Tab = "goals" | "appraisal" | "team" | "reviews" | "probation" | "pips" | "compensation" | "calibration" | "departmentGoals" | "setup";
const SECTIONS: Section[] = ["cycles", "templates", "competencies", "scales"];

/** /performance — performance (Phase 6). Everyone: their goals (task 9) and appraisal (task 10) in the cycles under
 * way; managers: their team's goals and the reviews they write; HR: calibration (performance.calibrate), department
 * goals and the setup (performance.manage, task 8). */
export default function PerformancePage() {
  const { t } = useTranslation();
  const { can, me } = useSession();
  const [params, setParams] = useSearchParams();
  const manage = can("performance.manage");
  const sets = can("performance.set_goals");
  const tabs: Tab[] = [
    ...(me?.employee ? (["goals", "appraisal"] as Tab[]) : []),
    ...(sets ? (["team", "reviews", "probation"] as Tab[]) : []),
    "pips",
    ...(can("performance.manage_compensation") || can("performance.propose_compensation") ? (["compensation"] as Tab[]) : []),
    ...(can("performance.calibrate") ? (["calibration"] as Tab[]) : []),
    ...(manage ? (["departmentGoals", "setup"] as Tab[]) : []),
  ];
  const asked = params.get("tab");
  const section: Section = SECTIONS.includes(asked as Section) ? (asked as Section) : "cycles";
  const tab: Tab = SECTIONS.includes(asked as Section) && manage ? "setup" : asked && tabs.includes(asked as Tab) ? (asked as Tab) : (tabs[0] ?? "goals");
  const cycles = useCycles();
  const [chosen, setChosen] = useState<number | null>(null);
  const cycle = cycles.find((c) => c.id === chosen) ?? cycles[0] ?? null;
  if (!can("performance.view")) return <NoAccess />;
  const needsCycle = !["setup", "probation", "pips", "compensation"].includes(tab);
  return (
    <Page
      title={t("performance.title")}
      tabs={tabs.length > 1 && <Tabs label={t("performance.title")} value={tab} onChange={(next) => setParams(next === tabs[0] ? {} : { tab: next }, { replace: true })} items={tabs.map((id) => ({ id, label: t(`performance.tabs.${id}`) }))} />}
      toolbar={needsCycle && cycles.length > 1 && <CyclePicker cycles={cycles} value={cycle?.id ?? null} onChange={setChosen} />}
    >
      {needsCycle && !cycle ? (
        <Card>
          <p className="text-muted">{t("performance.noCurrent")}</p>
        </Card>
      ) : (
        <>
          {tab === "goals" && cycle && (
            <div className="flex flex-col gap-4">
              <CycleBanner cycle={cycle} />
              <GoalSheetCard cycle={cycle} title={t("performance.goals.mine")} />
            </div>
          )}
          {tab === "team" && cycle && <TeamGoals cycle={cycle} />}
          {tab === "appraisal" && cycle && <MyAppraisal cycle={cycle} />}
          {tab === "reviews" && cycle && <Reviews cycle={cycle} />}
          {tab === "calibration" && cycle && <Calibration cycle={cycle} />}
          {tab === "probation" && <ProbationCard />}
          {tab === "pips" && <PipsCard />}
          {tab === "compensation" && <CompensationCard />}
          {tab === "departmentGoals" && cycle && <DepartmentGoalsCard cycle={cycle} />}
          {tab === "setup" && (
            <div className="flex flex-col gap-4">
              <Tabs variant="segmented" label={t("performance.tabs.setup")} value={section} onChange={(next) => setParams({ tab: next }, { replace: true })} items={SECTIONS.map((id) => ({ id, label: t(`performance.tabs.${id}`) }))} />
              {section === "cycles" && <CyclesCard />}
              {section === "templates" && <TemplatesCard />}
              {section === "competencies" && <CompetenciesCard />}
              {section === "scales" && <ScalesCard />}
            </div>
          )}
        </>
      )}
    </Page>
  );
}

function CycleBanner({ cycle }: { cycle: NonNullable<ReturnType<typeof useCycles>[number]> }) {
  const { t } = useTranslation();
  const format = useFormat();
  return (
    <section aria-label={t("performance.current")} className="flex flex-wrap items-center gap-2 rounded-card bg-white/70 p-4 shadow-soft">
      <span className="font-semibold">{format.name(cycle)}</span>
      <span className="num text-sm text-muted">{format.dateRange(cycle.period_start, cycle.period_end)}</span>
      {cycle.open_phases.map((p) => (
        <Pill key={p} tone="teal">{t(`performance.phases.${p}`)}</Pill>
      ))}
      <span className="num ms-auto text-sm text-muted">{t("performance.goals.goalsUntil", { date: format.date(cycle.goals_until) })}</span>
    </section>
  );
}
