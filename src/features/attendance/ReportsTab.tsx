import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { attendanceBoard, type ReportColumn, type ReportKind } from "@/api/attendance";
import { hr } from "@/api/hr";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { DateInput } from "@/design/DateInput";
import { FormSelect, SearchInput } from "@/design/Field";
import { toISODate } from "@/lib/format";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";
import { ExportButtons } from "@/features/reports/ExportButtons";

import { hm } from "./clock";

type Row = Record<string, string | number | null>;

/** Attendance reports (Phase 3 task 16): daily, monthly summary, lateness, absence, overtime and device sync — the
 * same rows on the screen and as Excel (audited). The sync report is for who manages attendance. */
export function ReportsTab() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const kinds: ReportKind[] = ["daily", "monthly", "lateness", "absence", "overtime", ...(can("attendance.manage") ? (["sync"] as const) : [])];
  const today = toISODate(new Date());
  const [kind, setKind] = useState<ReportKind>("monthly");
  const [q, setQ] = useState({ date: today, from: `${today.slice(0, 8)}01`, to: today, department: "", search: "" });
  const query = {
    ...(kind === "daily" ? { date: q.date } : { from: q.from, to: q.to }),
    department: q.department ? Number(q.department) : undefined,
    search: q.search || undefined,
  };
  const report = useQuery({ queryKey: ["attendance-report", kind, query, ...scope], queryFn: () => attendanceBoard.report(kind, query), placeholderData: keepPreviousData });
  const departments = useQuery({ queryKey: ["setup", "departments", ...scope], queryFn: hr.departmentRows });

  const cell = (c: ReportColumn) => (row: Row) => {
    const value = row[c.key];
    if (value === null || value === undefined || value === "") return <span className="text-muted">—</span>;
    if (c.kind === "duration") return <span className="num">{value ? hm(Number(value)) : "—"}</span>;
    if (c.kind === "number") return <span className="num">{format.number(Number(value))}</span>;
    if (c.kind === "date") return <span className="num">{format.date(String(value), "dayMonthYear")}</span>;
    return String(value);
  };
  const columns: Column<Row>[] = (report.data?.columns ?? []).map((c) => ({ id: c.key, header: c.label, cell: cell(c) }));
  return (
    <Card
      variant="solid"
      title={t("attendanceReports.title")}
      subtitle={t("attendanceReports.hint")}
      action={
        can("employees.export") && (
          <ExportButtons disabled={!report.data} download={(as) => attendanceBoard.exportReport(kind, query, as)} />
        )
      }
    >
      <div className="mb-4 grid gap-3 md:grid-cols-5">
        <FormSelect label={t("attendanceReports.kind")} name="kind" value={kind} onChange={(e) => setKind(e.target.value as ReportKind)} options={kinds.map((k) => ({ value: k, label: t(`attendanceReports.kinds.${k}`) }))} />
        {kind === "daily" ? (
          <DateInput label={t("record.date")} name="date" value={q.date} max={today} onChange={(d) => d && setQ({ ...q, date: d })} />
        ) : (
          <>
            <DateInput label={t("attendanceReports.from")} name="from" value={q.from} max={today} onChange={(d) => d && setQ({ ...q, from: d })} />
            <DateInput label={t("attendanceReports.to")} name="to" value={q.to} max={today} onChange={(d) => d && setQ({ ...q, to: d })} />
          </>
        )}
        {kind !== "sync" && (
          <>
            <FormSelect label={t("leaveReport.department")} name="department" value={q.department} placeholder={t("leaveReport.everyDepartment")} options={(departments.data?.results ?? []).map((d) => ({ value: String(d.id), label: format.name(d) }))} onChange={(e) => setQ({ ...q, department: e.target.value })} />
            <SearchInput label={t("roster.search")} className="self-end" value={q.search} onChange={(e) => setQ({ ...q, search: e.target.value })} />
          </>
        )}
      </div>
      {report.isError && <Alert className="mb-3">{apiErrors(report.error, t("common.loadFailed")).general ?? apiErrors(report.error, "").fields.to}</Alert>}
      <DataTable caption={report.data?.title ?? t("attendanceReports.title")} columns={columns} rows={report.data?.rows ?? []} rowKey={(r) => JSON.stringify([r.employee_no, r.date, r.when, r.connection])} loading={report.isPending} empty={t("attendanceReports.empty")} minWidth={Math.max(720, columns.length * 110)} />
    </Card>
  );
}
