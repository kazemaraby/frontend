import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { hr } from "@/api/hr";
import { useScopeKey, useSession } from "@/auth/session";
import { Card } from "@/design/Card";
import { Tabs } from "@/design/Tabs";
import { Page } from "@/layout/Page";

import { TaskList } from "./TaskList";

/** /onboarding: tasks waiting for me; HR also sees every open task of the employees in their scope. */
export default function OnboardingPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const scopeKey = useScopeKey();
  const [params, setParams] = useSearchParams();
  const hrView = can("onboarding.manage");
  const tab = hrView && params.get("tab") === "all" ? "all" : "mine";
  const query = tab === "mine" ? { mine: 1, status: "open" } : { status: "open" };
  const tasks = useQuery({ queryKey: ["onboarding", ...scopeKey, query], queryFn: () => hr.onboardingTasks(query) });
  return (
    <Page
      title={t("onboarding.title")}
      tabs={
        hrView ? (
          <Tabs
            label={t("onboarding.title")}
            value={tab}
            onChange={(id) => setParams(id === "mine" ? {} : { tab: id })}
            items={[
              { id: "mine", label: t("onboarding.tabs.mine") },
              { id: "all", label: t("onboarding.tabs.all") },
            ]}
          />
        ) : undefined
      }
    >
      <Card>
        <TaskList tasks={tasks.data?.results ?? []} loading={tasks.isPending} showEmployee />
      </Card>
    </Page>
  );
}
