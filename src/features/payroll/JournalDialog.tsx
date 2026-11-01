import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { accounting, type JournalFile, type PayrollRun } from "@/api/payroll";
import { useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { type Column, DataTable } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { FormSelect, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { openFile } from "@/features/employees/download";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

/** The run's payroll journal (#104, Phase 4 task 20; decision 8: files, no push): its lines by account, cost center
 * and employee, debit = credit, what must be set first, and the files for ERPNext (Journal Entry CSV for Data Import,
 * or JSON) or any system (CSV). */
export function JournalDialog({ run, onClose }: { run: PayrollRun; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const preview = useQuery({ queryKey: ["journal", run.id], queryFn: () => accounting.journal(run.id) });
  const lastDay = new Date(Number(run.month.slice(0, 4)), Number(run.month.slice(5, 7)), 0);
  const [v, setV] = useState({ format: "erpnext_csv", posting_date: `${run.month}-${String(lastDay.getDate()).padStart(2, "0")}` });
  const make = useMutation({ mutationFn: () => accounting.makeJournal(run.id, v), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["journal", run.id] }) });
  const open = useMutation({ mutationFn: (id: number) => openFile(() => accounting.journalLink(run.id, id)) });
  const errors = apiErrors(make.error, t("common.saveFailed"));
  const data = preview.data;
  const frozen = run.stage === "locked" || run.stage === "paid";
  const lines: Column<NonNullable<typeof data>["lines"][number]>[] = [
    { id: "account", header: t("accounting.account"), cell: (ln) => <span dir="ltr" className="text-sm">{ln.account || "—"}</span> },
    { id: "center", header: t("accounting.fields.cost_center"), cell: (ln) => <span dir="ltr" className="text-sm">{ln.cost_center}</span> },
    { id: "party", header: t("accounting.party"), cell: (ln) => <span className="num text-sm">{ln.party}</span> },
    { id: "debit", header: t("accounting.debit"), cell: (ln) => (Number(ln.debit) ? <Money amount={ln.debit} fractionDigits={[2, 2]} /> : "") },
    { id: "credit", header: t("accounting.credit"), cell: (ln) => (Number(ln.credit) ? <Money amount={ln.credit} fractionDigits={[2, 2]} /> : "") },
  ];
  const files: Column<JournalFile>[] = [
    { id: "name", header: t("accounting.file"), cell: (f) => <span dir="ltr" className="text-sm">{f.file_name}</span> },
    { id: "date", header: t("accounting.postingDate"), cell: (f) => <span className="num">{format.date(f.posting_date)}</span> },
    { id: "total", header: t("accounting.debit"), cell: (f) => <Money amount={f.total} fractionDigits={[2, 2]} /> },
    { id: "actions", header: <span className="sr-only">{t("common.actions")}</span>, cell: (f) => <IconButton size="sm" variant="plain" label={t("wageFiles.download", { name: f.file_name })} icon={<Download />} onClick={() => open.mutate(f.id)} /> },
  ];
  return (
    <Dialog open size="lg" onClose={onClose} title={t("accounting.journalTitle")}>
      <div className="flex flex-col gap-4">
        {!frozen && <Alert tone="info">{t("accounting.afterApproval")}</Alert>}
        {data?.problems.map((p) => (
          <Alert key={p} tone="warning">
            {p}
          </Alert>
        ))}
        {frozen && can("payroll.manage") && (
          <div className="grid items-end gap-3 sm:grid-cols-3">
            <FormSelect label={t("wageFiles.format")} name="format" value={v.format} onChange={(e) => setV({ ...v, format: e.target.value })} options={(data?.formats ?? []).map((f) => ({ value: f, label: t(`accounting.formats.${f}`) }))} />
            <TextField label={t("accounting.postingDate")} name="posting_date" type="date" value={v.posting_date} onChange={(e) => setV({ ...v, posting_date: e.target.value })} error={errors.fields.posting_date} />
            <Button variant="accent" disabled={make.isPending || Boolean(data?.problems.length)} onClick={() => make.mutate()}>
              {t("accounting.make")}
            </Button>
          </div>
        )}
        {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
        {data && (
          <div role="status" className="flex flex-wrap gap-x-6 gap-y-1 rounded-card bg-teal-soft px-4 py-3 text-sm text-teal-ink">
            <span>
              {t("accounting.debit")} <Money amount={data.debit} fractionDigits={[2, 2]} className="font-semibold" />
            </span>
            <span>
              {t("accounting.credit")} <Money amount={data.credit} fractionDigits={[2, 2]} className="font-semibold" />
            </span>
            <span className="num">{t("accounting.lines", { n: format.number(data.lines.length) })}</span>
          </div>
        )}
        <DataTable caption={t("accounting.files")} columns={files} rows={data?.files ?? []} rowKey={(f) => String(f.id)} loading={preview.isPending} empty={t("accounting.noFiles")} minWidth={560} />
        <DataTable caption={t("accounting.journalTitle")} columns={lines} rows={data?.lines ?? []} rowKey={(ln) => `${ln.account}|${ln.cost_center}|${ln.party}`} loading={preview.isPending} empty={t("accounting.noLines")} minWidth={560} />
      </div>
    </Dialog>
  );
}
