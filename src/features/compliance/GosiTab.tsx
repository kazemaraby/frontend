import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type ContributionRow, type GosiBranch, type GosiIssue, type GosiIssueCode, gosiApi, type InvoiceRow, type InvoiceStatus } from "@/api/compliance";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable, PersonCell } from "@/design/DataTable";
import { SearchInput, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { Pagination } from "@/design/Pagination";
import { Pill, type PillTone } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { saveFile } from "@/lib/saveFile";
import { useFormat } from "@/lib/useFormat";

import { FilterChip } from "./QiwaTab";

const CODES: GosiIssueCode[] = ["not_registered", "stopped_at_work", "left_registered", "not_ours", "wage_differs", "nationality_differs", "start_differs", "id_differs"];
const ISSUE_TONES: Record<GosiIssueCode, PillTone> = {
  not_registered: "salmon",
  stopped_at_work: "salmon",
  left_registered: "lavender",
  not_ours: "amber",
  wage_differs: "orange",
  nationality_differs: "orange",
  start_differs: "orange",
  id_differs: "orange",
};
const INVOICE_TONES: Record<InvoiceStatus, PillTone> = { same: "green", differs: "orange", not_invoiced: "amber", not_on_payroll: "salmon", not_ours: "salmon" };
const BRANCHES: GosiBranch[] = ["annuities", "saned", "hazards"];
const PAGE_SIZE = 25;

function lastMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** The GOSI register (Phase 5 task 7, #108): GOSI's subscribers list against our employees; the month's invoice against
 * its approved payrolls; the month's contributions per establishment and GOSI branch (both need payroll access). */
export function GosiTab() {
  const { t } = useTranslation();
  const { can } = useSession();
  const [month, setMonth] = useState(lastMonth());
  return (
    <div className="flex flex-col gap-6">
      <RegisterCard />
      {can("payroll.view") && (
        <>
          <TextField className="sm:w-56" label={t("gosiRegister.month")} name="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          {month && <InvoiceCard month={month} />}
          {month && <ContributionsCard month={month} />}
        </>
      )}
    </div>
  );
}

function RegisterCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const [issue, setIssue] = useState<GosiIssueCode | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: ["gosi-register", issue, search, page, ...scope],
    queryFn: () => gosiApi.issues({ issue: issue || undefined, search: search || undefined, page }),
    placeholderData: keepPreviousData,
  });
  const value = (i: GosiIssue, v: string | null) => {
    if (i.hidden) return <span className="text-muted">•••</span>;
    if (v == null) return "—";
    if (i.code === "wage_differs") return <Money amount={v} />;
    if (i.code === "start_differs") return format.date(v);
    return (
      <span dir="ltr" className="num">
        {v}
      </span>
    );
  };
  const columns: Column<GosiIssue>[] = [
    {
      id: "who",
      header: t("compliance.employee"),
      cell: (i) =>
        i.employee ? (
          <PersonCell name={format.name(i.employee)} subtitle={i.employee.employee_no} />
        ) : (
          <span className="flex flex-col text-sm">
            <span>{i.subscriber?.name || t("gosiRegister.notOurs")}</span>
            <span dir="ltr" className="num text-xs text-muted">{i.subscriber?.id_number}</span>
          </span>
        ),
    },
    { id: "issue", header: t("qiwa.issue"), cell: (i) => <Pill tone={ISSUE_TONES[i.code]}>{t(`gosiRegister.codes.${i.code}`)}</Pill>, className: "w-64" },
    { id: "ours", header: t("compliance.ours"), cell: (i) => value(i, i.ours), className: "w-36" },
    { id: "theirs", header: t("gosiRegister.atGosi"), cell: (i) => value(i, i.theirs), className: "w-36" },
    { id: "number", header: t("gosiRegister.gosiNumber"), cell: (i) => <span dir="ltr" className="num text-sm">{i.subscriber?.gosi_number || "—"}</span>, className: "w-32" },
  ];
  const data = list.data;
  return (
    <Card variant="solid" title={t("gosiRegister.registerTitle")} subtitle={t("gosiRegister.registerHint")}>
      {data && !data.known && <Alert tone="info" className="mb-4">{t("gosiRegister.unknown")}</Alert>}
      {list.isError && <Alert className="mb-4">{apiErrors(list.error, t("common.loadFailed")).general}</Alert>}
      {data?.known && (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t("qiwa.filter")}>
          <FilterChip active={issue === ""} onClick={() => { setIssue(""); setPage(1); }} label={t("qiwa.all")} />
          {CODES.filter((c) => data.counts[c] > 0).map((c) => (
            <FilterChip key={c} active={issue === c} onClick={() => { setIssue(c); setPage(1); }} label={`${t(`gosiRegister.codes.${c}`)} · ${format.number(data.counts[c])}`} />
          ))}
        </div>
      )}
      <div className="mb-3">
        <SearchInput label={t("common.search")} placeholder={t("common.searchPlaceholder")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full sm:w-72" />
      </div>
      <DataTable caption={t("gosiRegister.registerTitle")} columns={columns} rows={data?.results ?? []} rowKey={(i) => `${i.code}-${i.employee?.id ?? ""}-${i.subscriber?.id ?? ""}`} loading={list.isPending} empty={data?.known ? t("qiwa.nothing") : t("qiwa.nothingYet")} minWidth={900} />
      {(data?.count ?? 0) > PAGE_SIZE && <Pagination page={page} pageCount={Math.ceil((data?.count ?? 0) / PAGE_SIZE)} onPageChange={setPage} />}
    </Card>
  );
}

function InvoiceCard({ month }: { month: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const invoice = useQuery({ queryKey: ["gosi-invoice", month, ...scope], queryFn: () => gosiApi.invoice(month), placeholderData: keepPreviousData });
  const pair = (ee: string, er: string) => (
    <span className="flex flex-col text-sm">
      <Money amount={(Number(ee) + Number(er)).toFixed(2)} />
      <span className="whitespace-nowrap text-xs text-muted">{t("gosiRegister.split", { ee: format.number(ee, [0, 2]), er: format.number(er, [0, 2]) })}</span>
    </span>
  );
  const columns: Column<InvoiceRow>[] = [
    {
      id: "who",
      header: t("compliance.employee"),
      cell: (r) => (r.employee ? <PersonCell name={format.name(r.employee)} subtitle={r.employee.employee_no} /> : <span dir="ltr" className="num text-sm">{r.id_number}</span>),
    },
    { id: "status", header: t("gosiRegister.check"), cell: (r) => <Pill tone={INVOICE_TONES[r.status]}>{t(`gosiRegister.invoiceStatuses.${r.status}`)}</Pill>, className: "w-44" },
    { id: "payroll", header: t("gosiRegister.inPayroll"), cell: (r) => pair(r.payroll_ee, r.payroll_er), className: "w-56" },
    { id: "invoice", header: t("gosiRegister.inInvoice"), cell: (r) => pair(r.invoice_ee, r.invoice_er), className: "w-56" },
    { id: "difference", header: t("gosiRegister.difference"), cell: (r) => (Number(r.difference) ? <Money amount={r.difference} /> : <span className="text-muted">—</span>), className: "w-32" },
  ];
  const data = invoice.data;
  const rows = (data?.rows ?? []).filter((r) => r.status !== "same");
  return (
    <Card variant="solid" title={t("gosiRegister.invoiceTitle")} subtitle={t("gosiRegister.invoiceHint")}>
      {invoice.isError && <Alert className="mb-4">{apiErrors(invoice.error, t("common.loadFailed")).fields.month ?? apiErrors(invoice.error, t("common.loadFailed")).general}</Alert>}
      {data && !data.read && <Alert tone="info" className="mb-4">{t("gosiRegister.noInvoice", { month: format.date(data.month, "monthYear") })}</Alert>}
      {data && (
        <p className="num mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            {t("gosiRegister.totalPayroll")}: <Money amount={data.totals.payroll} />
          </span>
          <span>
            {t("gosiRegister.totalInvoice")}: <Money amount={data.totals.invoice} />
          </span>
          <span className="font-medium">
            {t("gosiRegister.difference")}: <Money amount={data.totals.difference} />
          </span>
          <span className="text-muted">{t("gosiRegister.same", { count: (data.rows.length - rows.length) })}</span>
        </p>
      )}
      <DataTable caption={t("gosiRegister.invoiceTitle")} columns={columns} rows={rows} rowKey={(r) => `${r.employee?.id ?? r.id_number}-${r.status}`} loading={invoice.isPending} empty={t("gosiRegister.allSame")} minWidth={980} />
    </Card>
  );
}

function ContributionsCard({ month }: { month: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const report = useQuery({ queryKey: ["gosi-contributions", month, ...scope], queryFn: () => gosiApi.contributions(month), placeholderData: keepPreviousData });
  const exporting = useMutation({ mutationFn: async () => saveFile(await gosiApi.exportContributions(month)) });
  const money = (v: string) => <Money amount={v} />;
  const columns: Column<ContributionRow>[] = [
    { id: "establishment", header: t("establishments.establishment"), cell: (r) => <bdi dir="ltr" className="num font-medium">{r.establishment || t("establishments.noNumber")}</bdi>, className: "w-36" },
    { id: "people", header: t("nitaqat.headcount"), cell: (r) => <span className="num">{format.number(r.people)}</span>, className: "w-24" },
    { id: "wage", header: t("gosiRegister.wage"), cell: (r) => money(r.wage) },
    ...BRANCHES.map((b) => ({ id: b, header: t(`gosiRegister.branches.${b}`), cell: (r: ContributionRow) => <span className="flex flex-col text-sm">{money((Number(r[`${b}_ee`]) + Number(r[`${b}_er`])).toFixed(2))}<span className="whitespace-nowrap text-xs text-muted">{t("gosiRegister.split", { ee: format.number(r[`${b}_ee`], [0, 2]), er: format.number(r[`${b}_er`], [0, 2]) })}</span></span> })),
    { id: "total", header: t("gosiRegister.total"), cell: (r) => <span className="font-medium">{money(r.total)}</span> },
  ];
  const data = report.data;
  return (
    <Card
      variant="solid"
      title={t("gosiRegister.contributionsTitle")}
      subtitle={t("gosiRegister.contributionsHint")}
      action={
        can("compliance.export") && (
          <Button size="sm" variant="outline" icon={<FileDown className="size-4" />} disabled={exporting.isPending || !data?.rows.length} onClick={() => exporting.mutate()}>
            {t("saudization.export")}
          </Button>
        )
      }
    >
      {(report.isError || exporting.isError) && <Alert className="mb-4">{apiErrors(report.error ?? exporting.error, t("common.loadFailed")).general}</Alert>}
      <DataTable caption={t("gosiRegister.contributionsTitle")} columns={columns} rows={data?.rows ?? []} rowKey={(r) => r.establishment} loading={report.isPending} empty={t("gosiRegister.noPayroll")} minWidth={900} />
      {data && data.rows.length > 1 && (
        <p className="num mt-3 flex flex-wrap gap-x-6 text-sm font-medium">
          <span>{t("gosiRegister.total")}</span>
          <span>{t("gosiRegister.split", { ee: format.number(data.totals.employee_total, [0, 2]), er: format.number(data.totals.employer_total, [0, 2]) })}</span>
          <Money amount={data.totals.total} />
        </p>
      )}
    </Card>
  );
}
