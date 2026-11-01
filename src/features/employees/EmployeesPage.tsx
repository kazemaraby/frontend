import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FileUp, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { ApiError, type Employee, type EmployeeStatus, endpoints } from "@/api";
import { hr } from "@/api/hr";
import { useScopeKey, useSession } from "@/auth/session";
import { Button } from "@/design/Button";
import { Card, CardLink } from "@/design/Card";
import { type Column, DataTable, PersonCell } from "@/design/DataTable";
import { SearchInput, Select } from "@/design/Field";
import { Pagination } from "@/design/Pagination";
import { StatusChip } from "@/design/Pill";
import { Tabs } from "@/design/Tabs";
import NoAccess from "@/features/misc/NoAccessPage";
import { Page } from "@/layout/Page";
import { useDebounced } from "@/lib/useDebounced";
import { useFormat } from "@/lib/useFormat";
import { ExportButtons } from "@/features/reports/ExportButtons";

import { useMasterData } from "./masterData";

const PAGE_SIZE = 7; // as in docs/design
const STATUSES: EmployeeStatus[] = ["pending", "hired", "active", "suspended", "terminated", "contract_ended"];

export default function EmployeesPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const { can, company } = useSession();
  const navigate = useNavigate();
  const scopeKey = useScopeKey();
  const [tab, setTab] = useState<"all" | "team">("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [branch, setBranch] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [saudi, setSaudi] = useState("");
  const master = useMasterData();
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search.trim());

  // Filters are applied by the API inside the user's data scope; the page never filters by company itself.
  // The same filters drive the export (#131), so the file is exactly the filtered list (all pages).
  const criteria = { search: debouncedSearch, status, department, branch, job_title: jobTitle, saudi, team: tab === "team" ? 1 : undefined };
  const filters = { page, page_size: PAGE_SIZE, ...criteria };
  const employees = useQuery({
    queryKey: ["employees", ...scopeKey, filters],
    queryFn: ({ signal }) => endpoints.employees(filters, signal),
    placeholderData: keepPreviousData,
  });
  const departments = useQuery({ queryKey: ["departments", scopeKey[0]], queryFn: endpoints.departments });

  if (employees.error instanceof ApiError && employees.error.status === 403) return <NoAccess />;

  const departmentName = new Map((departments.data?.results ?? []).map((d) => [d.id, format.name(d)]));
  const branchName = new Map((company?.branches ?? []).map((b) => [b.id, format.name(b)]));
  const resetPage = <V,>(set: (v: V) => void) => (v: V) => {
    set(v);
    setPage(1);
  };

  const columns: Column<Employee>[] = [
    { id: "no", header: t("employees.columns.number"), cell: (e) => <span className="num font-semibold">{e.employee_no}</span>, className: "w-36" },
    { id: "name", header: t("employees.columns.name"), cell: (e) => <PersonCell name={format.name(e)} /> },
    { id: "status", header: t("employees.columns.status"), cell: (e) => <StatusChip status={e.status} /> },
    { id: "department", header: t("employees.columns.department"), cell: (e) => (e.department ? departmentName.get(e.department) : null) ?? "—" },
    { id: "branch", header: t("employees.columns.branch"), cell: (e) => (e.branch ? branchName.get(e.branch) : null) ?? "—" },
    {
      id: "file",
      header: <span className="sr-only">{t("common.actions")}</span>,
      cell: (e) => (
        <CardLink aria-label={t("employees.viewFileOf", { name: format.name(e) })} onClick={() => navigate(`/employees/${e.id}`)}>
          {t("employees.viewFile")}
        </CardLink>
      ),
      className: "w-32 text-end",
    },
  ];

  const data = employees.data;
  const total = data?.count ?? 0;
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <Page
      title={t("employees.title")}
      tabs={
        <Tabs
          label={t("employees.title")}
          value={tab}
          onChange={resetPage(setTab)}
          items={[
            { id: "all", label: t("employees.tabs.all") },
            { id: "team", label: t("employees.tabs.myTeam") },
          ]}
        />
      }
      actions={
        <>
          {can("employees.export") && (
            <ExportButtons download={(as) => hr.exportEmployees(criteria, as)} />
          )}
          {can("employees.import") && (
            <Button variant="outline" icon={<FileUp className="size-[18px]" />} onClick={() => navigate("/employees/import")}>
              {t("imports.importButton")}
            </Button>
          )}
          {can("employees.create") && (
            <Button variant="accent" icon={<Plus className="size-[18px]" />} onClick={() => navigate("/employees/new")}>
              {t("employees.add")}
            </Button>
          )}
        </>
      }
    >
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <SearchInput
            label={t("employees.searchPlaceholder")}
            placeholder={t("employees.searchPlaceholder")}
            value={search}
            onChange={(e) => resetPage(setSearch)(e.target.value)}
            className="w-full sm:w-80 [&_input]:border-white [&_input]:shadow-soft"
          />
          <Select
            label={t("employees.allStatuses")}
            value={status}
            onChange={(e) => resetPage(setStatus)(e.target.value)}
            options={[{ value: "", label: t("employees.allStatuses") }, ...STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))]}
            className="flex-1 sm:flex-none [&_select]:border-white [&_select]:shadow-soft"
          />
          <Select
            label={t("employees.allDepartments")}
            value={department}
            onChange={(e) => resetPage(setDepartment)(e.target.value)}
            options={[
              { value: "", label: t("employees.allDepartments") },
              ...(departments.data?.results ?? []).map((d) => ({ value: String(d.id), label: format.name(d) })),
            ]}
            className="flex-1 sm:flex-none [&_select]:border-white [&_select]:shadow-soft"
          />
          {(company?.branches.length ?? 0) > 1 && (
            <Select
              label={t("employees.allBranches")}
              value={branch}
              onChange={(e) => resetPage(setBranch)(e.target.value)}
              options={[{ value: "", label: t("employees.allBranches") }, ...master.options.branches]}
              className="flex-1 sm:flex-none [&_select]:border-white [&_select]:shadow-soft"
            />
          )}
          <Select
            label={t("employees.allJobTitles")}
            value={jobTitle}
            onChange={(e) => resetPage(setJobTitle)(e.target.value)}
            options={[{ value: "", label: t("employees.allJobTitles") }, ...master.options.jobTitles]}
            className="flex-1 sm:flex-none [&_select]:border-white [&_select]:shadow-soft"
          />
          {can("employees.view_personal") && (
            <Select
              label={t("employees.nationalityFilter")}
              value={saudi}
              onChange={(e) => resetPage(setSaudi)(e.target.value)}
              options={[
                { value: "", label: t("employees.allNationalities") },
                { value: "1", label: t("employees.saudi") },
                { value: "0", label: t("employees.nonSaudi") },
              ]}
              className="flex-1 sm:flex-none [&_select]:border-white [&_select]:shadow-soft"
            />
          )}
        </div>
        {employees.isError && !(employees.error instanceof ApiError && employees.error.status === 403) ? (
          <p role="alert" className="rounded-card bg-danger-soft px-4 py-3 text-sm text-danger">
            {t("common.loadFailed")}
          </p>
        ) : (
          <div aria-busy={employees.isFetching} className={employees.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
            <DataTable
              caption={t("employees.title")}
              columns={columns}
              rows={data?.results ?? []}
              rowKey={(e) => String(e.id)}
              rowLabel={(e) => format.name(e)}
              loading={employees.isPending}
              minWidth={860}
            />
          </div>
        )}
        <Pagination
          page={page}
          pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
          onPageChange={setPage}
          summary={t("employees.showing", { from: format.number(from), to: format.number(to), count: total, total: format.number(total) })}
        />
      </Card>
    </Page>
  );
}
