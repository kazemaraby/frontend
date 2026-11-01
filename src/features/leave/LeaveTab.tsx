import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type Employee, holds } from "@/api";
import { leave, type LeaveBalance } from "@/api/leave";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { FormSelect, TextField } from "@/design/Field";
import { Pagination } from "@/design/Pagination";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

type Entry = Awaited<ReturnType<typeof leave.entries>>["results"][number];

/** The employee file's leave tab: a card per leave type with its balance, and the ledger behind it (#68).
 * HR (leave.manage_balances over the employee) adjusts a balance or enters an opening one. */
export function LeaveTab({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  const format = useFormat();
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [adjusting, setAdjusting] = useState(false);
  const data = useQuery({ queryKey: ["employee", employee.id, "leave", "balances"], queryFn: () => leave.balances(employee.id) });
  const ledger = useQuery({
    queryKey: ["employee", employee.id, "leave", "entries", typeFilter, page],
    queryFn: () => leave.entries(employee.id, typeFilter ? Number(typeFilter) : undefined, page),
    placeholderData: keepPreviousData,
  });
  const pages = Math.ceil((ledger.data?.count ?? 0) / 50);
  const balances = data.data?.balances ?? [];
  const days = (v: string | number | null | undefined) => (v === null || v === undefined ? "—" : format.number(Number(v), [0, 2]));
  const typeName = (id: number) => {
    const found = balances.find((b) => b.leave_type.id === id)?.leave_type;
    return found ? format.name(found) : `#${id}`;
  };

  const columns: Column<Entry>[] = [
    { id: "date", header: t("leaveTab.columns.date"), cell: (e) => <span className="num">{format.date(e.entry_date)}</span> },
    { id: "type", header: t("leaveTab.columns.type"), cell: (e) => typeName(e.leave_type) },
    { id: "kind", header: t("leaveTab.columns.kind"), cell: (e) => <span>{t(`leaveTab.kinds.${e.kind}`)}</span> },
    {
      id: "days",
      header: t("leaveTab.columns.days"),
      cell: (e) => <span className={`num font-medium ${Number(e.days) < 0 ? "text-danger" : "text-teal-ink"}`}>{Number(e.days) > 0 ? "+" : ""}{days(e.days)}</span>,
    },
    { id: "note", header: t("leaveTab.columns.note"), cell: (e) => <span className="text-sm text-muted">{e.note || e.reference || "—"}</span> },
    { id: "by", header: t("leaveTab.columns.by"), cell: (e) => <span className="text-sm text-muted">{e.created_by ? format.name(e.created_by) : t("history.system")}</span> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card
        variant="solid"
        title={t("leaveTab.balances")}
        subtitle={balances.find((b) => b.year)?.year ? t("leaveTab.year", { from: format.date(balances.find((b) => b.year)!.year!.start), to: format.date(balances.find((b) => b.year)!.year!.end) }) : undefined}
        action={
          holds(employee, "leave.manage_balances") && (
            <Button size="sm" variant="outline" icon={<SlidersHorizontal className="size-4" />} onClick={() => setAdjusting(true)}>
              {t("leaveTab.adjust")}
            </Button>
          )
        }
      >
        {data.isPending ? (
          <p className="text-muted">{t("common.loading")}</p>
        ) : data.isError ? (
          <Alert>{t("common.loadFailed")}</Alert>
        ) : (
          <ul aria-label={t("leaveTab.balances")} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {balances.map((b) => (
              <li key={b.leave_type.id} className="flex flex-col gap-2 rounded-tile border border-line bg-white p-4">
                <p className="flex items-center justify-between gap-2">
                  <Pill tone={b.leave_type.color}>{format.name(b.leave_type)}</Pill>
                  {!b.paid && <span className="text-xs text-muted">{t("leaveSettings.unpaid")}</span>}
                </p>
                <BalanceFigures balance={b} days={days} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        variant="solid"
        title={t("leaveTab.ledger")}
        action={
          <FormSelect
            label={t("leaveTab.columns.type")}
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            placeholder={t("leaveTab.allTypes")}
            options={balances.map((b) => ({ value: String(b.leave_type.id), label: format.name(b.leave_type) }))}
            className="min-w-48"
          />
        }
      >
        <DataTable caption={t("leaveTab.ledger")} columns={columns} rows={ledger.data?.results ?? []} rowKey={(e) => String(e.id)} loading={ledger.isPending} empty={t("leaveTab.noEntries")} minWidth={760} />
        {pages > 1 && <Pagination page={page} pageCount={pages} onPageChange={setPage} />}
      </Card>
      {adjusting && <AdjustDialog employee={employee} balances={balances} onClose={() => setAdjusting(false)} />}
    </div>
  );
}

function BalanceFigures({ balance: b, days }: { balance: LeaveBalance; days: (v: string | number | null | undefined) => string }) {
  const { t } = useTranslation();
  if (b.kind === "occasion" || b.kind === "unlimited") {
    return (
      <p className="text-sm text-muted">
        {b.kind === "occasion" && b.entitled ? t("leaveTab.eachTime", { days: days(b.entitled) }) : t(`leaveTab.kindHint.${b.kind}`)}
      </p>
    );
  }
  const unit = t(b.count_mode === "working" ? "leaveTab.workingDays" : "leaveTab.days");
  return (
    <>
      <p className="flex items-baseline gap-1.5">
        <span className="num text-3xl font-semibold text-ink">{days(b.available)}</span>
        <span className="text-sm text-muted">{unit}</span>
      </p>
      <dl className="num grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted">
        {b.kind === "yearly" && (
          <>
            <dt>{t("leaveTab.parts.entitled")}</dt>
            <dd>{days(b.entitled)}</dd>
            {Number(b.parts.carried) !== 0 && (<><dt>{t("leaveTab.parts.carried")}</dt><dd>{days(b.parts.carried)}</dd></>)}
            {Number(b.parts.opening) !== 0 && (<><dt>{t("leaveTab.parts.opening")}</dt><dd>{days(b.parts.opening)}</dd></>)}
            <dt>{t("leaveTab.parts.accrued")}</dt>
            <dd>{days(b.parts.accrued)}</dd>
          </>
        )}
        {b.kind === "window" && (<><dt>{t("leaveTab.parts.window")}</dt><dd>{days(b.entitled)}</dd></>)}
        {b.kind === "service" && (<><dt>{t("leaveTab.parts.service")}</dt><dd>{days(b.entitled)}</dd></>)}
        <dt>{t("leaveTab.parts.taken")}</dt>
        <dd>{days(b.parts.taken)}</dd>
        {Number(b.parts.adjusted) !== 0 && (<><dt>{t("leaveTab.parts.adjusted")}</dt><dd>{days(b.parts.adjusted)}</dd></>)}
        {Number(b.pending) !== 0 && (<><dt>{t("leaveTab.parts.pending")}</dt><dd>{days(b.pending)}</dd></>)}
      </dl>
    </>
  );
}

function AdjustDialog({ employee, balances, onClose }: { employee: Employee; balances: LeaveBalance[]; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const withBalance = balances.filter((b) => b.kind === "yearly" || b.kind === "service" || b.kind === "window");
  const [values, setValues] = useState({ leave_type: withBalance[0] ? String(withBalance[0].leave_type.id) : "", kind: "adjustment" as "adjustment" | "opening", days: "", entry_date: "", note: "" });
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((v) => ({ ...v, [key]: value }));
  const save = useMutation({
    mutationFn: () =>
      leave.createEntry({ employee: employee.id, leave_type: Number(values.leave_type), kind: values.kind, days: values.days.trim(), note: values.note, ...(values.entry_date ? { entry_date: values.entry_date } : {}) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employee", employee.id, "leave"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("leaveTab.adjust")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={save.isPending || !values.days.trim() || !values.leave_type} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormSelect label={t("leaveTab.columns.type")} name="leave_type" value={values.leave_type} onChange={(e) => set("leave_type", e.target.value)} options={withBalance.map((b) => ({ value: String(b.leave_type.id), label: format.name(b.leave_type) }))} error={errors.fields.leave_type} />
          <FormSelect label={t("leaveTab.columns.kind")} name="kind" value={values.kind} onChange={(e) => set("kind", e.target.value as "adjustment" | "opening")} options={(["adjustment", "opening"] as const).map((k) => ({ value: k, label: t(`leaveTab.kinds.${k}`) }))} error={errors.fields.kind} />
          <TextField label={t("leaveTab.columns.days")} name="days" inputMode="decimal" dir="ltr" value={values.days} onChange={(e) => set("days", e.target.value)} hint={t(values.kind === "opening" ? "leaveTab.openingHint" : "leaveTab.daysHint")} error={errors.fields.days} required />
          <DateInput label={values.kind === "opening" ? t("leaveTab.asOf") : t("leaveTab.columns.date")} name="entry_date" value={values.entry_date || null} onChange={(d) => set("entry_date", d ?? "")} hint={t("leaveTab.dateHint")} error={errors.fields.entry_date} />
        </div>
        <TextField label={t("leaveTab.columns.note")} name="note" value={values.note} onChange={(e) => set("note", e.target.value)} required={values.kind === "adjustment"} error={errors.fields.note} />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
