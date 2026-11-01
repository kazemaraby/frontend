import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { endpoints } from "@/api";
import { dashboard, type DepartmentRow, type ReportQuery, type ReportRow } from "@/api/dashboard";
import { leave } from "@/api/leave";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { DateInput } from "@/design/DateInput";
import { FormSelect, SearchInput } from "@/design/Field";
import { Pagination } from "@/design/Pagination";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";
import { ExportButtons } from "@/features/reports/ExportButtons";

const PAGE_SIZE = 25;

function Utilisation({ value }: { value: string | null }) {
  const format = useFormat();
  if (value === null) return <span className="text-muted">—</span>;
  const pct = Math.max(0, Math.min(100, Number(value)));
  return (
    <span className="flex min-w-28 items-center gap-2">
      <span className="h-2 flex-1 rounded-full bg-neutral-soft" aria-hidden="true">
        <span className="block h-2 rounded-full bg-teal-dark" style={{ width: `${pct}%` }} />
      </span>
      <span className="num w-12 text-end text-sm">{format.number(Number(value), [0, 1])}%</span>
    </span>
  );
}

/** Leave balance report (#132): one leave type's balance and use per department and per employee, in the user's
 * data scope (leave.view_balances); Excel with employees.export. */
export function BalanceReport() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const [query, setQuery] = useState<ReportQuery>({});
  const [page, setPage] = useState(1);
  const types = useQuery({ queryKey: ["leave", "types", "active", ...scope], queryFn: () => leave.types(true) });
  const departments = useQuery({ queryKey: ["master", "departments", ...scope], queryFn: endpoints.departments });
  const report = useQuery({ queryKey: ["leave", "report", query, ...scope], queryFn: () => dashboard.leaveReport(query), placeholderData: (previous) => previous });
  const set = (patch: ReportQuery) => {
    setQuery((q) => ({ ...q, ...patch }));
    setPage(1);
  };
  const days = (v: string | null) => (v === null ? "—" : format.number(Number(v), [0, 2]));
  const rows = report.data?.rows ?? [];
  const yearly = rows.some((r) => r.kind === "yearly");

  const deptColumns: Column<DepartmentRow>[] = [
    { id: "department", header: t("leaveReport.department"), cell: (d) => <span className="font-semibold text-ink">{d.department ? format.name(d.department) : t("leaveReport.noDepartment")}</span> },
    { id: "employees", header: t("leaveReport.employees"), cell: (d) => <span className="num">{format.number(d.employees)}</span> },
    { id: "taken", header: t("leaveReport.taken"), cell: (d) => <span className="num">{days(d.taken)}</span> },
    { id: "pending", header: t("leaveReport.pending"), cell: (d) => <span className="num">{days(d.pending)}</span> },
    { id: "available", header: t("leaveReport.balance"), cell: (d) => <span className="num font-semibold">{days(d.available)}</span> },
    { id: "use", header: t("leaveReport.utilisation"), cell: (d) => <Utilisation value={d.utilisation} /> },
  ];
  const columns: Column<ReportRow>[] = [
    {
      id: "employee",
      header: t("leaveReport.employee"),
      cell: (r) => (
        <span className="flex flex-col">
          <span className="font-semibold text-ink">{format.name(r.employee)}</span>
          <span className="num text-sm text-muted">
            {r.employee.employee_no}
            {r.department && ` · ${format.name(r.department)}`}
          </span>
        </span>
      ),
    },
    ...(yearly
      ? [
          { id: "entitled", header: t("leaveReport.entitled"), cell: (r: ReportRow) => <span className="num">{days(r.entitled)}</span> },
          {
            id: "granted",
            header: t("leaveReport.granted"),
            cell: (r: ReportRow) => <span className="num">{days(r.granted)}</span>,
          },
        ]
      : []),
    { id: "taken", header: t("leaveReport.taken"), cell: (r) => <span className="num">{days(r.taken)}</span> },
    { id: "pending", header: t("leaveReport.pending"), cell: (r) => <span className="num">{days(r.pending)}</span> },
    { id: "available", header: t("leaveReport.balance"), cell: (r) => <span className="num font-semibold">{days(r.available)}</span> },
    { id: "use", header: t("leaveReport.utilisation"), cell: (r) => <Utilisation value={r.utilisation} /> },
  ];
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <Card
        variant="solid"
        title={t("leaveReport.title")}
        subtitle={report.data ? t("leaveReport.asOf", { day: format.date(report.data.on) }) : undefined}
        action={
          can("employees.export") && (
            <ExportButtons download={(as) => dashboard.exportLeaveReport(query, as)} />
          )
        }
      >
        <div className="grid gap-3 md:grid-cols-4">
          <FormSelect
            label={t("leaveReport.type")}
            name="leave_type"
            value={String(query.leave_type ?? report.data?.leave_type.id ?? "")}
            options={(types.data ?? []).map((x) => ({ value: String(x.id), label: format.name(x) }))}
            onChange={(e) => set({ leave_type: Number(e.target.value) })}
          />
          <FormSelect
            label={t("leaveReport.department")}
            name="department"
            value={String(query.department ?? "")}
            placeholder={t("leaveReport.everyDepartment")}
            options={(departments.data?.results ?? []).map((d) => ({ value: String(d.id), label: format.name(d) }))}
            onChange={(e) => set({ department: e.target.value ? Number(e.target.value) : undefined })}
          />
          <DateInput label={t("leaveReport.on")} name="on" value={query.on ?? report.data?.on ?? null} onChange={(d) => set({ on: d ?? undefined })} />
          <SearchInput label={t("leaveReport.search")} className="self-end" value={query.search ?? ""} onChange={(e) => set({ search: e.target.value || undefined })} />
        </div>
        {report.error && <Alert className="mt-3">{apiErrors(report.error, t("common.loadFailed")).general}</Alert>}
      </Card>
      <Card variant="solid" title={t("leaveReport.byDepartment")}>
        <DataTable caption={t("leaveReport.byDepartment")} columns={deptColumns} rows={report.data?.departments ?? []} rowKey={(d) => String(d.department?.id ?? "none")} loading={report.isPending} empty={t("leaveReport.none")} minWidth={720} />
      </Card>
      <Card variant="solid" title={t("leaveReport.byEmployee")}>
        <DataTable caption={t("leaveReport.byEmployee")} columns={columns} rows={shown} rowKey={(r) => String(r.employee.id)} loading={report.isPending} empty={t("leaveReport.none")} minWidth={860} />
        {rows.length > PAGE_SIZE && <Pagination page={page} pageCount={Math.ceil(rows.length / PAGE_SIZE)} onPageChange={setPage} />}
      </Card>
    </div>
  );
}
