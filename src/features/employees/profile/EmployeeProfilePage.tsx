import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, LogOut, RefreshCw, UserPen } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams, useSearchParams } from "react-router";

import { ApiError, BANK_FIELDS, canRead, type Employee, holds, PERSONAL_FIELDS, SALARY_FIELDS } from "@/api";
import { hr } from "@/api/hr";
import { Alert } from "@/design/Alert";
import { Avatar } from "@/design/Avatar";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { DetailList } from "@/design/DetailList";
import { StatusChip } from "@/design/Pill";
import { Tabs } from "@/design/Tabs";
import NoAccess from "@/features/misc/NoAccessPage";
import { useSession } from "@/auth/session";
import { EmployeeMonth } from "@/features/attendance/EmployeeMonth";
import { EmployeePayCard } from "@/features/payroll/EmployeePayCard";
import { CustodyTab } from "@/features/custody/CustodyTab";
import { LeaveTab } from "@/features/leave/LeaveTab";
import { ProfileUpdateDialog } from "@/features/selfservice/ProfileUpdateDialog";
import { Page } from "@/layout/Page";
import { useFormat } from "@/lib/useFormat";

import { ActionDialog } from "../dialogs/ActionDialog";
import { StatusDialog } from "../dialogs/StatusDialog";
import { type MasterData, useMasterData } from "../masterData";
import { ContractsTab } from "./ContractsTab";
import { DisciplineTab } from "./DisciplineTab";
import { DocumentsTab, ExpiryChip } from "./DocumentsTab";
import { OffboardingCard, StartOffboardingDialog } from "./OffboardingCard";
import { EditableSection } from "./EditableSection";
import { DependentsTab, InsuranceTab } from "./FamilyTabs";
import { addressFields, bankFields, emergencyFields, jobFields, nameFields, personalFields, salaryFields } from "./fields";
import { HistoryTab, OnboardingTab } from "./HistoryTabs";
import { PendingApprovals } from "./PendingApprovals";

const TABS = ["overview", "personal", "job", "contracts", "leave", "attendance", "custody", "documents", "dependents", "insurance", "salary", "discipline", "history", "onboarding"] as const;
type Tab = (typeof TABS)[number];

/** /employees/:id?tab=… — the employee file. Tabs and sections follow what the user may see for this employee
 * (the API leaves out field groups the user can't read, and answers 403/404 for actions they can't take). */
export default function EmployeeProfilePage() {
  const { id } = useParams();
  const employeeId = Number(id);
  const { t } = useTranslation();
  const format = useFormat();
  const master = useMasterData();
  const [params, setParams] = useSearchParams();
  const [dialog, setDialog] = useState<"status" | "action" | "profile" | "offboarding" | null>(null);
  const { me, hasModule } = useSession();
  const query = useQuery({ queryKey: ["employee", employeeId], queryFn: () => hr.employee(employeeId), enabled: Number.isFinite(employeeId) });
  const employee = query.data;
  const manager = useQuery({
    queryKey: ["employee", employee?.manager, "summary"],
    queryFn: () => hr.employee(employee!.manager!),
    enabled: Boolean(employee?.manager),
    retry: false, // the manager may be outside the user's scope
  });

  if (!Number.isFinite(employeeId)) return <Navigate to="/employees" replace />;
  if (query.error instanceof ApiError && (query.error.status === 404 || query.error.status === 403)) return <NoAccess />;
  if (!employee) {
    return (
      <Page title={t("employees.title")}>
        <Card>{query.isError ? <Alert>{t("common.loadFailed")}</Alert> : <p className="text-muted">{t("common.loading")}</p>}</Card>
      </Page>
    );
  }

  const shown: Record<Tab, boolean> = {
    overview: true,
    personal: canRead(employee, PERSONAL_FIELDS),
    job: true,
    contracts: true,
    leave: holds(employee, "leave.view_balances"),
    attendance: hasModule("attendance") && (holds(employee, "attendance.view") || me?.employee?.id === employee.id),
    custody: holds(employee, "selfservice.view_custody"),
    documents: holds(employee, "employees.view_documents"),
    dependents: canRead(employee, PERSONAL_FIELDS),
    insurance: canRead(employee, PERSONAL_FIELDS),
    salary: canRead(employee, SALARY_FIELDS) || canRead(employee, BANK_FIELDS),
    history: true,
    onboarding: holds(employee, "onboarding.manage"),
    discipline: holds(employee, "employees.manage_discipline") || me?.employee?.id === employee.id,
  };
  const visibleTabs = TABS.filter((tab) => shown[tab]);
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && shown[requested] ? requested : "overview";
  const managerName = manager.data ? format.name(manager.data) : "";

  return (
    <Page
      title={format.name(employee)}
      tabs={
        <Tabs
          label={t("employee.sections")}
          value={tab}
          onChange={(next) => setParams(next === "overview" ? {} : { tab: next }, { replace: true })}
          items={visibleTabs.map((id) => ({ id, label: t(`employee.tabs.${id}`) }))}
        />
      }
      actions={
        <>
          {me?.employee?.id === employee.id && !holds(employee, "employees.change_personal") && (
            <Button variant="outline" icon={<UserPen className="size-[18px]" />} onClick={() => setDialog("profile")}>
              {t("profileUpdate.title")}
            </Button>
          )}
          {holds(employee, "employees.change_status") && (
            <Button variant="outline" icon={<RefreshCw className="size-[18px]" />} onClick={() => setDialog("status")}>
              {t("employee.status.change")}
            </Button>
          )}
          {holds(employee, "employees.change_status") && ["active", "suspended"].includes(employee.status) && (
            <Button variant="outline" icon={<LogOut className="size-[18px]" />} onClick={() => setDialog("offboarding")}>
              {t("offboarding.start")}
            </Button>
          )}
          {holds(employee, "employees.manage_lifecycle") && ["hired", "active", "suspended"].includes(employee.status) && (
            <Button icon={<ArrowRightLeft className="size-[18px]" />} onClick={() => setDialog("action")}>
              {t("employee.actions.new")}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Header employee={employee} master={master} managerName={managerName} />
        {(holds(employee, "employees.change_status") || holds(employee, "employees.manage_lifecycle")) && <PendingApprovals employee={employee} />}
        {tab === "overview" && holds(employee, "employees.change_status") && <OffboardingCard employee={employee} />}
        {tab === "overview" && <Overview employee={employee} master={master} managerName={managerName} />}
        {tab === "personal" && (
          <>
            <EditableSection employee={employee} title={t("employee.sectionTitles.name")} fields={nameFields(t)} canEdit={holds(employee, "employees.change")} />
            <EditableSection
              employee={employee}
              title={t("employee.sectionTitles.personal")}
              fields={personalFields(t, format, master)}
              canEdit={holds(employee, "employees.change_personal")}
            />
            <EditableSection employee={employee} title={t("employee.sectionTitles.address")} fields={addressFields(t)} canEdit={holds(employee, "employees.change_personal")} />
            <EditableSection employee={employee} title={t("employee.sectionTitles.emergency")} fields={emergencyFields(t)} canEdit={holds(employee, "employees.change_personal")} />
          </>
        )}
        {tab === "job" && (
          <EditableSection
            employee={employee}
            title={t("employee.sectionTitles.job")}
            fields={jobFields(t, format, master, managerName)}
            canEdit={holds(employee, "employees.change")}
          />
        )}
        {tab === "contracts" && <ContractsTab employee={employee} master={master} />}
        {tab === "documents" && <DocumentsTab employee={employee} master={master} />}
        {tab === "dependents" && <DependentsTab employee={employee} master={master} />}
        {tab === "insurance" && <InsuranceTab employee={employee} />}
        {tab === "salary" && (
          <>
            <EditableSection
              employee={employee}
              title={t("employee.sectionTitles.salary")}
              fields={salaryFields(t, employee)}
              canEdit={holds(employee, "employees.change_salary")}
              note={employee.status !== "pending" ? <Alert tone="info">{t("employee.salaryByAction")}</Alert> : undefined}
            />
            <EditableSection employee={employee} title={t("employee.sectionTitles.bank")} fields={bankFields(t, master)} canEdit={holds(employee, "employees.change_bank")} />
            {hasModule("payroll") && canRead(employee, SALARY_FIELDS) && <EmployeePayCard employee={employee} />}
          </>
        )}
        {tab === "leave" && <LeaveTab employee={employee} />}
        {tab === "attendance" && <EmployeeMonth employeeId={employee.id} />}
        {tab === "custody" && <CustodyTab employee={employee} />}
        {tab === "history" && <HistoryTab employee={employee} master={master} />}
        {tab === "onboarding" && <OnboardingTab employee={employee} />}
        {tab === "discipline" && <DisciplineTab employee={employee} />}
      </div>
      {dialog === "status" && <StatusDialog employee={employee} onClose={() => setDialog(null)} />}
      {dialog === "profile" && <ProfileUpdateDialog onClose={() => setDialog(null)} />}
      {dialog === "action" && <ActionDialog employee={employee} master={master} onClose={() => setDialog(null)} />}
      {dialog === "offboarding" && <StartOffboardingDialog employee={employee} onClose={() => setDialog(null)} />}
    </Page>
  );
}

function Header({ employee, master, managerName }: { employee: Employee; master: MasterData; managerName: string }) {
  const { t, i18n } = useTranslation();
  const format = useFormat();
  const other = i18n.language === "en" ? employee.name_ar : employee.name_en;
  const facts = [
    master.name.jobTitle(employee.job_title),
    master.name.department(employee.department),
    master.name.branch(employee.branch),
    managerName && t("employee.reportsTo", { name: managerName }),
  ].filter(Boolean);
  return (
    <Card variant="solid">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={format.name(employee)} size="lg" className="size-16 text-2xl" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-xl font-semibold text-ink">{format.name(employee)}</span>
            <StatusChip status={employee.status} />
          </p>
          {other && <p className="text-sm text-muted">{other}</p>}
          <p className="num mt-1 text-sm text-muted">
            <span className="font-semibold text-ink">{employee.employee_no}</span>
            {facts.length > 0 && ` · ${facts.join(" · ")}`}
          </p>
          {employee.status_reason && <p className="mt-1 text-sm text-muted">{employee.status_reason}</p>}
        </div>
      </div>
    </Card>
  );
}

function Overview({ employee, master, managerName }: { employee: Employee; master: MasterData; managerName: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const documents = useQuery({
    queryKey: ["employee", employee.id, "documents"],
    queryFn: () => hr.documents(employee.id),
    enabled: holds(employee, "employees.view_documents"),
  });
  const contracts = useQuery({ queryKey: ["employee", employee.id, "contracts"], queryFn: () => hr.contracts(employee.id) });
  const progress = useQuery({
    queryKey: ["onboarding", "progress", employee.id],
    queryFn: () => hr.onboardingProgress(employee.id),
    enabled: holds(employee, "onboarding.manage"),
  });
  const running = contracts.data?.find((c) => c.status === "active" || c.status === "renewed");
  const attention = (documents.data ?? []).filter((d) => d.expiry_status === "expiring" || d.expiry_status === "expired");
  const date = (d: string | null) => (d ? format.date(d) : "");
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card variant="solid" title={t("employee.overview.keyFacts")} className="lg:col-span-2">
        <DetailList
          items={[
            { label: t("employee.fields.job_title"), value: master.name.jobTitle(employee.job_title) },
            { label: t("employee.fields.department"), value: master.name.department(employee.department) },
            { label: t("employee.fields.manager"), value: managerName },
            { label: t("employee.fields.hire_date"), value: date(employee.hire_date) },
            { label: t("employee.fields.probation_end"), value: date(employee.probation_end) },
            { label: t("employee.fields.mobile"), value: employee.mobile ? <span dir="ltr">{employee.mobile}</span> : "" },
            { label: t("employee.fields.work_email"), value: employee.work_email },
            {
              label: t("employee.overview.contract"),
              value: running
                ? `${master.name.contractType(running.contract_type)}${running.end_date ? ` · ${t("history.contractUntil", { date: format.date(running.end_date) })}` : ""}`
                : t("employee.overview.noContract"),
            },
          ]}
        />
      </Card>
      <div className="flex flex-col gap-4">
        {holds(employee, "employees.view_documents") && (
          <Card variant="solid" title={t("employee.overview.expiries")}>
            {attention.length === 0 ? (
              <p className="text-sm text-muted">{t("employee.overview.noExpiries")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {attention.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{master.name.documentType(d.document_type)}</span>
                    <ExpiryChip document={d} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        {progress.data && progress.data.total > 0 && (
          <Card variant="solid" title={t("onboarding.title")}>
            <p className="num text-sm text-muted">{t("onboarding.progress", { done: progress.data.done + progress.data.skipped, total: progress.data.total })}</p>
            <div className="mt-3 h-2 rounded-full bg-neutral-soft" role="progressbar" aria-valuemin={0} aria-valuemax={progress.data.total} aria-valuenow={progress.data.done}>
              <div className="h-2 rounded-full bg-teal-dark" style={{ width: `${(100 * (progress.data.done + progress.data.skipped)) / progress.data.total}%` }} />
            </div>
            {progress.data.overdue > 0 && <p className="mt-2 text-sm text-danger">{t("onboarding.overdueCount", { count: progress.data.overdue })}</p>}
          </Card>
        )}
      </div>
    </div>
  );
}
