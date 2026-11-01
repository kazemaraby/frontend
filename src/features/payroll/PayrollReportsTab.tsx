import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PAYROLL_REPORTS, type PayrollReport, type PayrollReportKind, payrollReports } from "@/api/payroll";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { FormSelect, SearchInput } from "@/design/Field";
import { Money } from "@/design/Money";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";
import { ExportButtons } from "@/features/reports/ExportButtons";

type Row = PayrollReport["rows"][number];

/** Payroll reports (Phase 4 task 21) for the month chosen on the page: the register and cost (#133), GOSI registered
 * vs paid, the change from the month before, advances and custody (#135, as of today), the end-of-service provision
 * and the final settlements — from the approved payrolls, with the money columns' totals; the same rows as Excel
 * (payroll.export, audited). */
export function PayrollReportsTab({ month }: { month: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const [kind, setKind] = useState<PayrollReportKind>("register");
  const [by, setBy] = useState<"department" | "branch" | "cost_center">("department");
  const [search, setSearch] = useState("");
  const query = { month, ...(kind === "cost" ? { by } : {}), ...(search ? { search } : {}) };
  const report = useQuery({ queryKey: ["payroll-report", kind, query, ...scope], queryFn: () => payrollReports.get(kind, query), placeholderData: keepPreviousData });
  const data = report.data?.kind === kind ? report.data : undefined;
  const cell = (c: PayrollReport["columns"][number]) => (row: Row) => {
    const value = row[c.key];
    if (value === null || value === undefined || value === "") return <span className="text-muted">—</span>;
    if (c.kind === "money") return <Money amount={String(value)} fractionDigits={[2, 2]} />;
    if (c.kind === "number") return <span className="num">{format.number(Number(value), [0, 2])}</span>;
    if (c.kind === "date") return <span className="num">{format.date(String(value), "dayMonthYear")}</span>;
    return String(value);
  };
  const columns: Column<Row>[] = (data?.columns ?? []).map((c) => ({ id: c.key, header: c.label, cell: cell(c) }));
  const money = (data?.columns ?? []).filter((c) => c.kind === "money");
  return (
    <Card
      variant="solid"
      title={t("payrollReports.title")}
      subtitle={data && !data.monthly ? t("payrollReports.asOfToday") : t("payrollReports.hint")}
      action={
        can("payroll.export") && (
          <ExportButtons disabled={!data} download={(as) => payrollReports.export(kind, query, as)} />
        )
      }
    >
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <FormSelect label={t("payrollReports.kind")} name="report" value={kind} onChange={(e) => setKind(e.target.value as PayrollReportKind)} options={PAYROLL_REPORTS.map((k) => ({ value: k, label: t(`payrollReports.kinds.${k}`) }))} className="w-full sm:w-72" />
        {kind === "cost" && (
          <FormSelect label={t("payrollReports.by")} name="by" value={by} onChange={(e) => setBy(e.target.value as typeof by)} options={(["department", "branch", "cost_center"] as const).map((b) => ({ value: b, label: t(`payrollReports.byOptions.${b}`) }))} className="w-full sm:w-56" />
        )}
        {kind !== "cost" && <SearchInput label={t("common.search")} placeholder={t("common.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-72" />}
      </div>
      {report.isError && <Alert>{apiErrors(report.error, t("common.loadFailed")).general}</Alert>}
      <DataTable caption={data?.title ?? t("payrollReports.title")} columns={columns} rows={data?.rows ?? []} rowKey={(r) => `${r.employee_no ?? r.group ?? ""}-${String(r.run ?? "")}`} loading={!data && report.isFetching} empty={t("payrollReports.none")} minWidth={Math.max(720, columns.length * 120)} />
      {data && data.rows.length > 0 && money.length > 0 && (
        <dl role="status" aria-label={t("payrollReports.totals")} className="mt-4 grid gap-x-6 gap-y-2 rounded-card bg-teal-soft px-4 py-3 text-sm text-teal-ink sm:grid-cols-3 xl:grid-cols-5">
          {money.map((c) => (
            <div key={c.key}>
              <dt>{c.label}</dt>
              <dd>
                <Money amount={data.totals[c.key] ?? "0"} fractionDigits={[2, 2]} className="font-semibold" />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}
