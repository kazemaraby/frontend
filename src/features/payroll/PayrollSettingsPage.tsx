import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { payroll, PAYROLL_LABOR } from "@/api/payroll";
import { useSession } from "@/auth/session";
import { Tabs } from "@/design/Tabs";
import { Page } from "@/layout/Page";
import { LaborValuesCard } from "@/features/setup/LaborValuesCard";
import { type SettingsField, SettingsTableCard } from "@/features/setup/SettingsTableCard";

import { AccountingTab } from "./AccountingTab";
import { ComponentsTab } from "./ComponentsTab";
import { GosiRatesTab } from "./GosiRatesTab";
import { PenaltiesTab } from "./PenaltiesTab";
import { StructuresTab } from "./StructuresTab";
import { PayrollAccountCard } from "./WageFiles";
import { ViolationsTab } from "./ViolationsTab";

const RULES: SettingsField[] = [
  { name: "daily_divisor", kind: "number" },
  { name: "proration", kind: "choice", options: ["divisor", "calendar"] },
  { name: "rounding", kind: "choice", options: ["half_up", "down"] },
  { name: "pay_day", kind: "number" },
  { name: "advance_max_months", kind: "decimal" },
  { name: "advance_max_installments", kind: "number" },
  { name: "advance_one_open", kind: "boolean" },
  { name: "advance_in_probation", kind: "boolean" },
  { name: "suspended_days_paid", kind: "boolean" },
  { name: "penalty_repeat_days", kind: "number" },
  { name: "gosi_partial_month", kind: "choice", options: ["prorated", "full"] },
  { name: "retro_months", kind: "number" },
];
const TABS = ["rules", "components", "structures", "penalties", "violations", "gosi", "accounting", "labor"] as const;
type Tab = (typeof TABS)[number];

/** /settings/payroll (Phase 4 task 1): the company's payroll rules (daily wage divisor, proration, rounding, pay day,
 * advances), the salary components and structures (task 3) and the Labor Law's payroll numbers (deduction caps, penalties, end of service), each with its article. */
export default function PayrollSettingsPage() {
  const { t } = useTranslation();
  const { can, me } = useSession();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && TABS.includes(requested) ? requested : "rules";
  const manage = can("payroll.manage_settings");
  return (
    <Page
      title={t("payrollSettings.title")}
      tabs={<Tabs label={t("payrollSettings.title")} value={tab} onChange={(next) => setParams(next === "rules" ? {} : { tab: next }, { replace: true })} items={TABS.map((id) => ({ id, label: t(`payrollSettings.tabs.${id}`) }))} />}
    >
      {tab === "components" && <ComponentsTab />}
      {tab === "structures" && <StructuresTab />}
      {tab === "penalties" && <PenaltiesTab />}
      {tab === "violations" && <ViolationsTab />}
      {tab === "gosi" && <GosiRatesTab />}
      {tab === "accounting" && <AccountingTab />}
      {tab === "rules" && (
        <SettingsTableCard
          queryKey="payroll-settings"
          load={payroll.settings}
          save={payroll.saveSettings}
          fields={RULES}
          labels="payrollSettings.rules"
          title={t("payrollSettings.rules.title")}
          hint={t("payrollSettings.rules.hint")}
          canAccount={manage && Boolean(me?.is_tenant_admin || can("core.manage_companies"))}
          canCompany={manage}
        />
      )}
      {tab === "rules" && <PayrollAccountCard />}
      {tab === "labor" && (
        <LaborValuesCard fields={PAYROLL_LABOR} title={t("payrollSettings.labor.title")} hint={t("payrollSettings.labor.hint")} labels="payrollSettings.labor.fields" />
      )}
    </Page>
  );
}
