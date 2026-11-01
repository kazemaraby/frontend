import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { EXPENSE_CATEGORIES, type ExpenseCategory, type ExpenseClaim, expenses, type NewLine } from "@/api/expenses";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Dialog } from "@/design/Dialog";
import { FileDrop } from "@/design/FileDrop";
import { FormSelect, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { apiErrors } from "@/lib/apiErrors";
import { toISODate } from "@/lib/format";
import { useFormat } from "@/lib/useFormat";

type Draft = Omit<NewLine, "file"> & { key: number; file: File | null };
const PAY_CURRENCY = "SAR";

/** An expense claim (#61): the purpose and each expense with its receipt. Sending makes the claim, adds the lines
 * with their receipts, then submits it; a returned claim (`editId`) is corrected and sent again. */
export function ExpenseClaimDialog({ editId, onClose }: { editId?: number; onClose: () => void }) {
  const { t } = useTranslation();
  const stored = useQuery({ queryKey: ["expense-claim", editId], queryFn: () => expenses.get(editId!), enabled: Boolean(editId) });
  if (editId && !stored.data)
    return (
      <Dialog open onClose={onClose} title={t("approvals.editAndResubmit")}>
        {stored.isError ? <Alert>{apiErrors(stored.error, t("common.loadFailed")).general}</Alert> : <p className="text-muted">{t("common.loading")}</p>}
      </Dialog>
    );
  return <ClaimForm stored={stored.data} onClose={onClose} />;
}

function ClaimForm({ stored, onClose }: { stored?: ExpenseClaim; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [purpose, setPurpose] = useState(stored?.purpose ?? "");
  const [claim, setClaim] = useState<ExpenseClaim | undefined>(stored);
  const blank = (key: number): Draft => ({ key, category: "travel", date: toISODate(new Date()), description: "", amount: "", currency: PAY_CURRENCY, rate: "1", file: null });
  const [drafts, setDrafts] = useState<Draft[]>(stored ? [] : [blank(1)]);
  const setDraft = (key: number, patch: Partial<Draft>) => setDrafts((all) => all.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const send = useMutation({
    mutationFn: async () => {
      // A claim made before a failure is reused, so trying again never makes a second one.
      let current = claim ?? (await expenses.create(purpose));
      if (claim && claim.purpose !== purpose) current = await expenses.update(claim.id, purpose);
      setClaim(current);
      for (const draft of drafts) {
        const { key: _key, file, ...line } = draft;
        current = await expenses.addLine(current.id, { ...line, currency: line.currency.toUpperCase(), file: file! });
        setClaim(current);
        setDrafts((all) => all.filter((d) => d.key !== draft.key));
      }
      return expenses.submit(current.id);
    },
    onSuccess: async () => {
      await Promise.all(["requests", "approvals"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onClose();
    },
  });
  const removeSaved = useMutation({
    mutationFn: async (lineId: number) => {
      await expenses.removeLine(claim!.id, lineId);
      return expenses.get(claim!.id);
    },
    onSuccess: setClaim,
  });
  const errors = apiErrors(send.error, t("common.saveFailed"));
  const ready = purpose.trim() && (claim?.lines.length || drafts.length) && drafts.every((d) => d.amount && d.file && d.date);
  const pending = drafts.reduce((sum, d) => sum + (Number(d.amount) || 0) * (Number(d.rate) || 0), 0);
  const saved = (claim?.lines ?? []).reduce((sum, line) => sum + Number(line.paid_amount), 0);
  const total = saved + pending;
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={stored ? `${t("approvals.editAndResubmit")} · ${t("selfService.kinds.expense")}` : t("selfService.kinds.expense")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="accent" disabled={!ready || send.isPending} onClick={() => send.mutate()}>
            {t("approvals.send")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label={t("expenses.purpose")} name="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} error={errors.fields.purpose} required />
        {claim && claim.lines.length > 0 && (
          <ul className="flex flex-col gap-2">
            {claim.lines.map((line) => (
              <li key={line.id} className="flex flex-wrap items-center gap-3 rounded-card border border-line px-4 py-2 text-sm">
                <span className="num">{format.date(line.date)}</span>
                <span className="font-medium">{t(`expenses.categories.${line.category}`)}</span>
                {line.description && <span className="text-muted">{line.description}</span>}
                <Money amount={line.amount} currency={line.currency} fractionDigits={[2, 2]} className="ms-auto" />
                <IconButton size="xs" variant="danger" label={t("common.delete")} icon={<Trash2 />} disabled={removeSaved.isPending} onClick={() => removeSaved.mutate(line.id)} />
              </li>
            ))}
          </ul>
        )}
        {drafts.map((d, i) => (
          <fieldset key={d.key} className="flex flex-col gap-3 rounded-card border border-line p-4">
            <legend className="px-1 font-semibold text-ink">{t("expenses.line", { n: format.number((claim?.lines.length ?? 0) + i + 1) })}</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormSelect label={t("expenses.category")} name={`category-${d.key}`} value={d.category} onChange={(e) => setDraft(d.key, { category: e.target.value as ExpenseCategory })} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: t(`expenses.categories.${c}`) }))} />
              <TextField label={t("expenses.date")} name={`date-${d.key}`} type="date" value={d.date} max={toISODate(new Date())} onChange={(e) => setDraft(d.key, { date: e.target.value })} />
              <TextField label={t("expenses.description")} name={`description-${d.key}`} value={d.description} onChange={(e) => setDraft(d.key, { description: e.target.value })} />
              <TextField label={t("expenses.amount")} name={`amount-${d.key}`} dir="ltr" inputMode="decimal" value={d.amount} onChange={(e) => setDraft(d.key, { amount: e.target.value })} />
              <TextField label={t("expenses.currency")} name={`currency-${d.key}`} dir="ltr" maxLength={3} value={d.currency} onChange={(e) => setDraft(d.key, { currency: e.target.value.toUpperCase(), rate: e.target.value.toUpperCase() === PAY_CURRENCY ? "1" : d.rate })} />
              {d.currency !== PAY_CURRENCY && <TextField label={t("expenses.rate", { currency: d.currency, pay: PAY_CURRENCY })} name={`rate-${d.key}`} dir="ltr" inputMode="decimal" value={d.rate} onChange={(e) => setDraft(d.key, { rate: e.target.value })} />}
            </div>
            <FileDrop label={t("expenses.receipt")} file={d.file} onChange={(file) => setDraft(d.key, { file })} />
            {drafts.length > 1 && (
              <Button size="sm" variant="ghost" className="self-start" icon={<Trash2 className="size-4" />} onClick={() => setDrafts((all) => all.filter((x) => x.key !== d.key))}>
                {t("expenses.removeLine")}
              </Button>
            )}
          </fieldset>
        ))}
        <Button size="sm" variant="outline" className="self-start" icon={<Plus className="size-4" />} onClick={() => setDrafts((all) => [...all, blank(Math.max(0, ...all.map((x) => x.key)) + 1)])}>
          {t("expenses.addLine")}
        </Button>
        <p role="status" className="flex items-center gap-2 font-semibold">
          {t("expenses.total")} <Money amount={total.toFixed(2)} fractionDigits={[2, 2]} />
        </p>
        <Alert tone="info">{t("expenses.paidHow")}</Alert>
        {(errors.fields.lines || errors.fields.file || errors.general) && <Alert>{errors.fields.lines ?? errors.fields.file ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
