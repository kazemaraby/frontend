import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type QiwaIssue, type QiwaIssueCode, qiwaApi, type QiwaStatus } from "@/api/compliance";
import { useScopeKey } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Card } from "@/design/Card";
import { type Column, DataTable, PersonCell } from "@/design/DataTable";
import { SearchInput } from "@/design/Field";
import { Money } from "@/design/Money";
import { Pagination } from "@/design/Pagination";
import { Pill, type PillTone } from "@/design/Pill";
import { cn } from "@/design/cn";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const CODES: QiwaIssueCode[] = ["undocumented", "renewal_undocumented", "pending", "rejected", "salary_differs", "dates_differ", "left_documented", "no_contract"];
const ISSUE_TONES: Record<QiwaIssueCode, PillTone> = {
  undocumented: "salmon",
  renewal_undocumented: "salmon",
  pending: "amber",
  rejected: "salmon",
  salary_differs: "orange",
  dates_differ: "orange",
  left_documented: "lavender",
  no_contract: "neutral",
};
const STATUS_TONES: Record<QiwaStatus, PillTone> = { documented: "green", pending: "amber", not_documented: "salmon", rejected: "salmon", expired: "neutral", ended: "neutral", unknown: "neutral" };
const PAGE_SIZE = 25;

/** Qiwa contract documentation (Phase 5 task 6, #110): what needs doing, from the latest read of Qiwa's contracts report
 * against our contracts. An undocumented Saudi counts zero in Nitaqat. Salaries only with salary access. */
export function QiwaTab() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const [issue, setIssue] = useState<QiwaIssueCode | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: ["qiwa", issue, search, page, ...scope],
    queryFn: () => qiwaApi.issues({ issue: issue || undefined, search: search || undefined, page }),
    placeholderData: keepPreviousData,
  });
  const range = (start: string | null | undefined, end: string | null | undefined) => (start ? (end ? format.dateRange(start, end) : t("qiwa.from", { day: format.date(start) })) : "—");
  const wage = (value: string | null | undefined) => (value === undefined ? null : value ? <Money amount={value} /> : "—");
  const columns: Column<QiwaIssue>[] = [
    { id: "who", header: t("compliance.employee"), cell: (i) => <PersonCell name={format.name(i.employee)} subtitle={i.employee.employee_no} /> },
    {
      id: "issue",
      header: t("qiwa.issue"),
      cell: (i) => (
        <span className="flex flex-col items-start gap-1">
          <Pill tone={ISSUE_TONES[i.code]}>{t(`qiwa.codes.${i.code}`)}</Pill>
          {i.since && <span className="text-xs text-muted">{t("qiwa.since", { day: format.date(i.since) })}</span>}
        </span>
      ),
      className: "w-56",
    },
    {
      id: "ours",
      header: t("qiwa.ours"),
      cell: (i) =>
        i.contract ? (
          <span className="flex flex-col items-start text-sm">
            <span dir="ltr" className="num">{i.contract.number || "—"}</span>
            <span className="text-xs text-muted">{range(i.contract.start, i.contract.end)}</span>
            {wage(i.contract.wage)}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      id: "theirs",
      header: t("qiwa.theirs"),
      cell: (i) =>
        i.qiwa ? (
          <span className="flex flex-col items-start gap-0.5 text-sm">
            <Pill tone={STATUS_TONES[i.qiwa.status]}>
              {t(`qiwa.statuses.${i.qiwa.status}`)}
            </Pill>
            <span dir="ltr" className="num">{i.qiwa.number || "—"}</span>
            <span className="text-xs text-muted">{range(i.qiwa.start, i.qiwa.end)}</span>
            {wage(i.qiwa.wage)}
          </span>
        ) : (
          <span className="text-muted">{t("qiwa.notInQiwa")}</span>
        ),
    },
  ];
  const data = list.data;
  const errors = apiErrors(list.error, t("common.loadFailed"));
  return (
    <Card variant="solid" title={t("qiwa.title")} subtitle={t("qiwa.hint")}>
      {data && !data.known && <Alert tone="info" className="mb-4">{t("qiwa.unknown")}</Alert>}
      {list.isError && <Alert className="mb-4">{errors.general}</Alert>}
      {data?.known && (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t("qiwa.filter")}>
          <FilterChip active={issue === ""} onClick={() => { setIssue(""); setPage(1); }} label={t("qiwa.all")} />
          {CODES.filter((c) => data.counts[c] > 0).map((c) => (
            <FilterChip key={c} active={issue === c} onClick={() => { setIssue(c); setPage(1); }} label={`${t(`qiwa.codes.${c}`)} · ${format.number(data.counts[c])}`} />
          ))}
        </div>
      )}
      <div className="mb-3">
        <SearchInput label={t("common.search")} placeholder={t("common.searchPlaceholder")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full sm:w-72" />
      </div>
      <DataTable caption={t("qiwa.title")} columns={columns} rows={data?.results ?? []} rowKey={(i) => `${i.code}-${i.employee.id}-${i.qiwa?.id ?? i.contract?.id ?? ""}`} loading={list.isPending} empty={data?.known ? t("qiwa.nothing") : t("qiwa.nothingYet")} minWidth={900} />
      {(data?.count ?? 0) > PAGE_SIZE && <Pagination page={page} pageCount={Math.ceil((data?.count ?? 0) / PAGE_SIZE)} onPageChange={setPage} />}
    </Card>
  );
}

export function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={cn("h-8 rounded-full border px-3 text-sm", active ? "border-navy bg-navy text-white" : "border-line-strong bg-white text-ink hover:bg-neutral-soft")}>
      {label}
    </button>
  );
}
