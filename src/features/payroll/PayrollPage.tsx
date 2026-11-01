import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Calculator, Eye, FileText, Pause, Play, Plus, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { hr } from "@/api/hr";
import { type PayrollRow, type PayrollRun, payslips, runs } from "@/api/payroll";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable, PersonCell } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { FormSelect, SearchInput, Select } from "@/design/Field";
import { KpiTile } from "@/design/KpiTile";
import { Money } from "@/design/Money";
import { Pagination } from "@/design/Pagination";
import { type Status, StatusChip } from "@/design/Pill";
import { Tabs } from "@/design/Tabs";
import { Page } from "@/layout/Page";
import { apiErrors } from "@/lib/apiErrors";
import { toISODate } from "@/lib/format";
import { useFormat } from "@/lib/useFormat";

import { AdditionalSalariesTab } from "./AdditionalSalariesTab";
import { BatchesTab } from "./BatchesTab";
import { PayCalculationCard } from "./PayCalculationCard";
import { PayrollReportsTab } from "./PayrollReportsTab";
import { JournalDialog } from "./JournalDialog";
import { WageFilesDialog } from "./WageFiles";

type Tab = "run" | "additional" | "batches" | "reports";
const TABS: Tab[] = ["run", "additional", "batches", "reports"];
const STAGE_CHIP: Record<PayrollRun["stage"], Status> = { draft: "draft", calculating: "pending", calculated: "pending", in_review: "pending", locked: "approved", paid: "active" };
const PAGE_SIZE = 25;

/** The months the page offers: the next one, this one and the eleven before. */
function months(): string[] {
  const today = new Date();
  return Array.from({ length: 13 }, (_, i) => toISODate(new Date(today.getFullYear(), today.getMonth() + 1 - i, 1)).slice(0, 7));
}

/** /payroll (Phase 4 task 12, the design's payroll screen): the month's payroll run in a currency — its tiles, every
 * employee with basic, allowances, deductions and net, the calculation behind each, and the steps of the run
 * (calculate, send for approval; approval locks it) — the month's additional salaries, and the run's batches. */
export default function PayrollPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const manage = can("payroll.manage");
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((x) => x === params.get("tab")) ?? "run";
  const options = useMemo(months, []);
  const month = params.get("month") ?? options[1];
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === null ? next.delete(k) : next.set(k, v)));
    setParams(next, { replace: true });
  };
  const branches = useQuery({ queryKey: ["branches", "all", ...scope], queryFn: hr.branches, select: (page) => page.results });
  const currencies = useMemo(() => Array.from(new Set(["SAR", ...(branches.data ?? []).map((b) => b.currency).filter(Boolean)])), [branches.data]);
  const currency = params.get("currency") ?? "SAR";
  const list = useQuery({ queryKey: ["payroll-runs", month, ...scope], queryFn: () => runs.list(month) });
  const [publishing, setPublishing] = useState<number | null>(null); // the payslip count when publishing started
  useEffect(() => {
    if (publishing === null) return;
    const stop = window.setTimeout(() => setPublishing(null), 30_000); // publishing again keeps the count: stop anyway
    return () => window.clearTimeout(stop);
  }, [publishing]);
  const mine = (list.data?.results ?? []).filter((r) => r.currency === currency && r.status !== "rejected" && r.status !== "cancelled");
  // ?run= only while that run is still one of the month's (a deleted one falls back to the month's own)
  const asked = mine.find((r) => r.id === Number(params.get("run")))?.id;
  const chosenId = asked ?? mine.find((r) => !r.branch && r.kind === "regular")?.id ?? mine[0]?.id;
  const runLabel = (r: PayrollRun) =>
    r.kind === "final_settlement" && r.employee_info
      ? t("settlement.runLabel", { name: format.name(r.employee_info) })
      : r.branch
        ? (branches.data ?? []).find((b) => b.id === r.branch)?.name_ar ?? String(r.branch)
        : t("payroll.allBranches");
  const run = useQuery({
    queryKey: ["payroll-run", chosenId],
    queryFn: () => runs.get(chosenId!),
    enabled: Boolean(chosenId),
    // poll while Celery works: a calculation, or payslips being published (until their count changes)
    refetchInterval: (q) => (q.state.data?.stage === "calculating" || (publishing !== null && q.state.data?.payslips === publishing) ? 1_000 : false),
  });
  const current = chosenId && run.data?.id === chosenId ? run.data : undefined;
  const refresh = () => Promise.all(["payroll-runs", "payroll-run", "payroll-rows"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
  const [creating, setCreating] = useState(false);
  const [filing, setFiling] = useState(false);
  const [journal, setJournal] = useState(false);

  return (
    <Page
      title={t("payroll.title")}
      tabs={<Tabs label={t("payroll.title")} value={tab} onChange={(next) => set({ tab: next === "run" ? null : next })} items={TABS.map((id) => ({ id, label: t(`payroll.tabs.${id}`) }))} />}
      actions={
        manage && (
          <>
            <Button variant="outline" icon={<FileText className="size-[18px]" />} disabled={!current} onClick={() => setFiling(true)}>
              {t("payroll.wpsFile")}
            </Button>
            <Button variant="outline" icon={<BookOpen className="size-[18px]" />} disabled={!current} onClick={() => setJournal(true)}>
              {t("accounting.journalButton")}
            </Button>
            <Button variant="accent" icon={<Plus className="size-[18px]" />} onClick={() => setCreating(true)}>
              {t("payroll.newRun")}
            </Button>
          </>
        )
      }
    >
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Select label={t("payroll.period")} value={month} onChange={(e) => set({ month: e.target.value, run: null })} options={options.map((m) => ({ value: m, label: format.date(`${m}-01`, "monthYear") }))} className="w-full sm:w-auto [&_select]:border-white [&_select]:shadow-soft" />
        <Select label={t("payroll.currency")} value={currency} onChange={(e) => set({ currency: e.target.value, run: null })} options={currencies.map((c) => ({ value: c, label: t("payroll.branchCurrency", { currency: c === "SAR" ? t("currency.SARName") : c }) }))} className="w-full sm:w-auto [&_select]:border-white [&_select]:shadow-soft" />
        {mine.length > 1 && (
          <Select label={t("payroll.run")} value={String(chosenId ?? "")} onChange={(e) => set({ run: e.target.value })} options={mine.map((r) => ({ value: String(r.id), label: runLabel(r) }))} className="w-full sm:w-auto [&_select]:border-white [&_select]:shadow-soft" />
        )}
      </div>
      {tab === "additional" && <AdditionalSalariesTab month={month} />}
      {tab === "reports" && <PayrollReportsTab month={month} />}
      {tab === "batches" && (current ? <BatchesTab run={current} onChanged={refresh} /> : <Card><p className="text-muted">{list.isPending || chosenId ? t("common.loading") : t("payroll.noRun")}</p></Card>)}
      {tab === "run" &&
        (current ? (
          <RunView run={current} onChanged={refresh} onPublishing={() => setPublishing(current.payslips)} />
        ) : (
          <Card>
            <p className="text-muted">{list.isPending || (chosenId && !current) ? t("common.loading") : t("payroll.noRun")}</p>
          </Card>
        ))}
      {filing && current && <WageFilesDialog run={current} onClose={() => setFiling(false)} />}
      {journal && current && <JournalDialog run={current} onClose={() => setJournal(false)} />}
      {creating && <NewRunDialog month={month} currency={currency} branches={branches.data ?? []} onClose={() => setCreating(false)} onMade={(id) => { set({ run: String(id), tab: null }); void refresh(); }} />}
    </Page>
  );
}

function RunView({ run, onChanged, onPublishing }: { run: PayrollRun; onChanged: () => Promise<unknown>; onPublishing: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const manage = can("payroll.manage");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<PayrollRow | null>(null);
  useEffect(() => setPage(1), [search, run.id]);
  const rows = useQuery({ queryKey: ["payroll-rows", run.id, search, page, run.calculated_at], queryFn: () => runs.rows(run.id, search, page), enabled: run.stage !== "draft" });
  const act = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSuccess: onChanged });
  const errors = apiErrors(act.error, t("common.saveFailed"));
  const busy = act.isPending || run.stage === "calculating";
  const chosen = Array.from(selected).map(Number);
  const totals = run.totals;
  const columns: Column<PayrollRow>[] = [
    { id: "no", header: t("payroll.columns.number"), cell: (r) => <span className="num font-semibold">{r.employee_info.employee_no}</span>, className: "w-32" },
    { id: "name", header: t("payroll.columns.name"), cell: (r) => <PersonCell name={format.name(r.employee_info)} subtitle={r.hold ? t("payroll.held") : r.warnings.length ? t("payroll.warnings", { n: format.number(r.warnings.length) }) : undefined} /> },
    { id: "basic", header: t("payroll.columns.basic"), cell: (r) => <Money amount={r.basic} /> },
    { id: "allowances", header: t("payroll.columns.allowances"), cell: (r) => <Money amount={r.allowances} /> },
    { id: "deductions", header: t("payroll.columns.deductions"), cell: (r) => <Money amount={r.deductions} className="text-danger" /> },
    { id: "net", header: t("payroll.columns.net"), cell: (r) => <Money amount={r.net} className="font-bold" /> },
    { id: "eos", header: t("payroll.columns.endOfService"), cell: (r) => (r.leaving ? t("common.yes") : t("common.no")) },
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      cell: (r) => (
        <span className="flex gap-1">
          <IconButton size="sm" variant="plain" label={t("payroll.viewCalc", { name: format.name(r.employee_info) })} icon={<Eye />} onClick={() => setViewing(r)} />
          {manage && run.editable && (
            <IconButton size="sm" variant="plain" label={t(r.hold ? "payroll.release" : "payroll.hold", { name: format.name(r.employee_info) })} icon={r.hold ? <Play /> : <Pause />} disabled={busy} onClick={() => act.mutate(() => runs.hold(run.id, r.id, !r.hold))} />
          )}
        </span>
      ),
    },
  ];
  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label={t("payroll.kpi.net", { month: format.date(`${run.month}-01`, "monthYear") })} value={<Money amount={totals.net ?? "0"} signClassName="text-muted" />} />
        <KpiTile label={t("payroll.kpi.gosi")} value={<Money amount={totals.gosi_employer ?? "0"} signClassName="text-muted" />} />
        <KpiTile label={t("payroll.kpi.headcount")} value={format.number(totals.headcount ?? 0)} />
        <KpiTile label={t("payroll.kpi.status")} value={<StatusChip status={STAGE_CHIP[run.in_review ? "in_review" : run.stage]} label={t(`payroll.stages.${run.in_review ? "in_review" : run.stage}`)} size="md" />} />
      </div>
      {manage && (
        <div className="mb-4 flex flex-wrap gap-2">
          {run.editable && (
            <Button variant="outline" icon={<Calculator className="size-4" />} disabled={busy} onClick={() => act.mutate(() => runs.calculate(run.id))}>
              {t(run.calculated_at ? "payroll.recalculate" : "payroll.calculate")}
            </Button>
          )}
          {run.editable && chosen.length > 0 && (
            <Button variant="outline" disabled={busy} onClick={() => act.mutate(async () => { await runs.calculate(run.id, rowsEmployees(rows.data?.results ?? [], chosen)); setSelected(new Set()); })}>
              {t("payroll.recalculateSelected", { n: format.number(chosen.length) })}
            </Button>
          )}
          {run.editable && run.stage === "calculated" && (
            <Button icon={<Send className="size-4" />} disabled={busy} onClick={() => act.mutate(() => runs.submit(run.id))}>
              {t("payroll.submit")}
            </Button>
          )}
          {(run.stage === "locked" || run.stage === "paid") && (
            <Button icon={<FileText className="size-4" />} disabled={busy} onClick={() => { onPublishing(); act.mutate(() => payslips.publish(run.id)); }}>
              {run.payslips ? t("payslips.republish", { n: format.number(run.payslips) }) : t("payslips.publish")}
            </Button>
          )}
          {run.editable && (
            <Button variant="ghost" icon={<Trash2 className="size-4" />} disabled={busy} onClick={() => act.mutate(() => runs.remove(run.id))}>
              {t("payroll.deleteRun")}
            </Button>
          )}
        </div>
      )}
      {run.stage === "calculating" && <Alert tone="info" className="mb-3">{t("payroll.calculating")}</Alert>}
      {run.in_review && <Alert tone="info" className="mb-3">{t("payroll.inReview")}</Alert>}
      {run.problems.map((p) => (
        <Alert key={p} tone="warning" className="mb-3">
          {p}
        </Alert>
      ))}
      {(errors.general || errors.fields.detail) && <Alert className="mb-3">{errors.fields.detail ?? errors.general}</Alert>}
      {run.kind === "final_settlement" && rows.data?.results[0] && <SettlementSummary run={run} row={rows.data.results[0]} />}
      <Card>
        <div className="mb-3">
          <SearchInput label={t("common.search")} placeholder={t("common.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-80 [&_input]:border-white [&_input]:shadow-soft" />
        </div>
        {run.stage === "draft" ? (
          <p className="text-muted">{t("payroll.notCalculated")}</p>
        ) : (
          <>
            <DataTable caption={t("payroll.title")} columns={columns} rows={rows.data?.results ?? []} rowKey={(r) => String(r.id)} rowLabel={(r) => format.name(r.employee_info)} selectable={manage && run.editable} selected={selected} onSelectedChange={setSelected} loading={rows.isPending} minWidth={1040} />
            {(rows.data?.count ?? 0) > PAGE_SIZE && <Pagination page={page} pageCount={Math.ceil((rows.data?.count ?? 0) / PAGE_SIZE)} onPageChange={setPage} />}
          </>
        )}
      </Card>
      {viewing && <RowDialog run={run} row={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

/** A final settlement's own part (task 19): the last day, why it ended, the award and the leave paid, the Art. 88
 * date to pay by, and what the clearance still waits for (the approval is refused until it is signed off). */
function SettlementSummary({ run, row }: { run: PayrollRun; row: PayrollRow }) {
  const { t } = useTranslation();
  const format = useFormat();
  const detail = useQuery({ queryKey: ["payroll-row", run.id, row.id, run.calculated_at], queryFn: () => runs.row(run.id, row.id) });
  const data = detail.data?.result.settlement;
  if (!data) return null;
  const service = data.eosb.service;
  return (
    <Card variant="solid" title={t("settlement.title")} subtitle={t("settlement.hint")} className="mb-4">
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3 xl:grid-cols-6">
        <div>
          <dt className="text-muted">{t("eosb.lastDay")}</dt>
          <dd className="num font-semibold">{format.date(data.last_day)}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("eosb.reason")}</dt>
          <dd className="font-semibold">{t(`eosb.reasons.${data.reason}`)}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("eosb.service")}</dt>
          <dd className="num font-semibold">{t("eosb.serviceValue", { y: format.number(service.years), m: format.number(service.months), d: format.number(service.days) })}</dd>
        </div>
        <div>
          <dt className="text-muted">{t(`eosb.rules.${data.eosb.fraction_rule}`)}</dt>
          <dd><Money amount={data.eosb.award} fractionDigits={[2, 2]} className="font-semibold" /></dd>
        </div>
        <div>
          <dt className="text-muted">{t("settlement.leave", { n: format.number(Number(data.encashment.days), [0, 2]) })}</dt>
          <dd><Money amount={data.encashment.amount} fractionDigits={[2, 2]} className="font-semibold" /></dd>
        </div>
        <div>
          <dt className="text-muted">{t("settlement.dueBy")}</dt>
          <dd className="num font-semibold">{format.date(data.due_by)}</dd>
        </div>
      </dl>
      {data.clearance.map((c) => (
        <Alert key={c} tone="warning" className="mt-3">
          {c}
        </Alert>
      ))}
      {Number(row.net) < 0 && <Alert className="mt-3">{t("settlement.owed")}</Alert>}
    </Card>
  );
}

function rowsEmployees(rows: PayrollRow[], ids: number[]): number[] {
  return rows.filter((r) => ids.includes(r.id)).map((r) => r.employee);
}

/** One employee's frozen calculation in the run, with its whole trace. */
function RowDialog({ run, row, onClose }: { run: PayrollRun; row: PayrollRow; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const detail = useQuery({ queryKey: ["payroll-row", run.id, row.id], queryFn: () => runs.row(run.id, row.id) });
  return (
    <Dialog open size="lg" onClose={onClose} title={`${format.name(row.employee_info)} · ${row.employee_info.employee_no}`}>
      {row.warnings.map((w) => (
        <Alert key={w} tone="warning" className="mb-2">
          {w}
        </Alert>
      ))}
      {detail.data ? <PayCalculationCard calc={detail.data.result} employeeId={row.employee} /> : <p className="text-muted">{t("common.loading")}</p>}
    </Dialog>
  );
}

function NewRunDialog({ month, currency, branches, onClose, onMade }: { month: string; currency: string; branches: { id: number; name_ar: string; name_en: string; currency: string }[]; onClose: () => void; onMade: (id: number) => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const [branch, setBranch] = useState("");
  const make = useMutation({
    mutationFn: async () => {
      const made = await runs.create({ month, currency, branch: branch ? Number(branch) : null });
      await runs.calculate(made.id);
      return made;
    },
    onSuccess: (made) => {
      onMade(made.id);
      onClose();
    },
  });
  const errors = apiErrors(make.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("payroll.newRun")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="accent" disabled={make.isPending} onClick={() => make.mutate()}>
            {t("payroll.makeAndCalculate")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p>{t("payroll.newRunFor", { month: format.date(`${month}-01`, "monthYear"), currency })}</p>
        <FormSelect label={t("payroll.branchOptional")} name="branch" value={branch} placeholder={t("payroll.allBranches")} onChange={(e) => setBranch(e.target.value)} options={branches.filter((b) => (b.currency || "SAR") === currency).map((b) => ({ value: String(b.id), label: format.name(b) }))} />
        {(errors.fields.month || errors.general) && <Alert>{errors.fields.month ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
