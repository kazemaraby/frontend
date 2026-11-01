import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { type AdvanceChangeInput, type AdvancePreview, type AdvanceRequestInput, advances } from "@/api/payroll";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Dialog } from "@/design/Dialog";
import { FormSelect, TextArea, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { apiErrors } from "@/lib/apiErrors";
import { toISODate } from "@/lib/format";
import { useFormat } from "@/lib/useFormat";

const nextMonth = () => {
  const day = new Date();
  return toISODate(new Date(day.getFullYear(), day.getMonth() + 1, 1)).slice(0, 7);
};

/** This month and the next two: when an early settlement may be taken from the salary. */
const comingMonths = () => {
  const day = new Date();
  return [0, 1, 2].map((n) => toISODate(new Date(day.getFullYear(), day.getMonth() + n, 1)).slice(0, 7));
};

function useDone(onClose: () => void) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all(["requests", "approvals", "advances"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
    onClose();
  };
}

function Loading({ error, onClose }: { error: unknown; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open onClose={onClose} title={t("approvals.editAndResubmit")}>
      {error ? <Alert>{apiErrors(error, t("common.loadFailed")).general}</Alert> : <p className="text-muted">{t("common.loading")}</p>}
    </Dialog>
  );
}

/** An advance request (#58): amount, installments, first month; the limits and the installment are shown as it is
 * filled in (Art. 92: an installment at most 10 % of the wage). */
export function AdvanceRequestDialog({ editId, onClose }: { editId?: number; onClose: () => void }) {
  const stored = useQuery({ queryKey: ["advance-request", editId], queryFn: () => advances.request(editId!), enabled: Boolean(editId) });
  if (editId && !stored.data) return <Loading error={stored.error} onClose={onClose} />;
  return <RequestForm stored={stored.data} onClose={onClose} />;
}

function RequestForm({ stored, onClose }: { stored?: AdvanceRequestInput & { id: number }; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const done = useDone(onClose);
  const [v, setV] = useState<AdvanceRequestInput>(stored ? { amount: stored.amount, installments: stored.installments, first_month: stored.first_month, reason: stored.reason } : { amount: "", installments: 6, first_month: nextMonth(), reason: "" });
  const [preview, setPreview] = useState<AdvancePreview | null>(null);
  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      advances.preview({ ...v, amount: v.amount || "0" }, stored?.id).then((p) => live && setPreview(p)).catch(() => live && setPreview(null));
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [v, stored?.id]);
  const send = useMutation({
    mutationFn: async () => {
      if (!stored) return advances.ask(v);
      await advances.correct(stored.id, v);
      return advances.resubmit(stored.id);
    },
    onSuccess: done,
  });
  const errors = apiErrors(send.error, t("common.saveFailed"));
  const shown = (field: string) => errors.fields[field] ?? (v.amount ? preview?.errors[field]?.[0] : undefined);
  return (
    <Dialog
      open
      onClose={onClose}
      title={stored ? `${t("approvals.editAndResubmit")} · ${t("selfService.kinds.advance")}` : t("selfService.kinds.advance")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="accent" disabled={!v.amount || send.isPending} onClick={() => send.mutate()}>
            {t("approvals.send")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label={t("advances.amount")} name="amount" dir="ltr" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} error={shown("amount")} />
          <TextField label={t("advances.installments")} name="installments" dir="ltr" inputMode="numeric" value={String(v.installments)} onChange={(e) => setV({ ...v, installments: Number(e.target.value) || 0 })} error={shown("installments")} />
          <TextField label={t("advances.firstMonth")} name="first_month" type="month" value={v.first_month} onChange={(e) => setV({ ...v, first_month: e.target.value })} error={shown("first_month")} />
        </div>
        {preview && (
          <div role="status" className="flex flex-wrap gap-x-6 gap-y-1 rounded-card bg-teal-soft px-4 py-3 text-sm text-teal-ink">
            {preview.installment && Number(preview.installment) > 0 && (
              <span>
                {t("advances.eachInstallment")} <Money amount={preview.installment} fractionDigits={[2, 2]} className="font-semibold" />
              </span>
            )}
            <span>
              {t("advances.maxAmount")} <Money amount={preview.max_amount} fractionDigits={[0, 2]} />
            </span>
            <span>
              {t("advances.maxInstallment")} <Money amount={preview.max_installment} fractionDigits={[0, 2]} />
            </span>
            <span className="num">{t("advances.maxInstallments", { n: format.number(preview.max_installments) })}</span>
          </div>
        )}
        {v.amount && (preview?.errors.detail?.[0] || errors.fields.detail) && <Alert>{errors.fields.detail ?? preview?.errors.detail?.[0]}</Alert>}
        <TextArea label={t("advances.reason")} name="reason" rows={2} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

/** Asking to postpone an installment or settle the rest of an advance early (#99). */
export function AdvanceChangeDialog({ editId, advanceId, onClose }: { editId?: number; advanceId?: number; onClose: () => void }) {
  const stored = useQuery({ queryKey: ["advance-change", editId], queryFn: () => advances.change(editId!), enabled: Boolean(editId) });
  if (editId && !stored.data) return <Loading error={stored.error} onClose={onClose} />;
  return <ChangeForm stored={stored.data} advanceId={advanceId} onClose={onClose} />;
}

function ChangeForm({ stored, advanceId, onClose }: { stored?: AdvanceChangeInput & { id: number }; advanceId?: number; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const done = useDone(onClose);
  const mine = useQuery({ queryKey: ["advances", "mine"], queryFn: advances.mine });
  const open = (mine.data ?? []).filter((a) => Number(a.balance) > 0);
  const [v, setV] = useState<AdvanceChangeInput>(stored ? { advance: stored.advance, kind: stored.kind, month: stored.month, reason: stored.reason } : { advance: advanceId ?? 0, kind: "postpone", month: nextMonth(), reason: "" });
  useEffect(() => {
    if (!v.advance && open.length) setV((x) => ({ ...x, advance: open[0].id }));
  }, [open, v.advance]);
  const send = useMutation({
    mutationFn: async () => {
      if (!stored) return advances.askChange(v);
      await advances.correctChange(stored.id, v);
      return advances.resubmitChange(stored.id);
    },
    onSuccess: done,
  });
  const errors = apiErrors(send.error, t("common.saveFailed"));
  const chosen = open.find((a) => a.id === v.advance);
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("selfService.kinds.advance_change")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="accent" disabled={!v.advance || send.isPending} onClick={() => send.mutate()}>
            {t("approvals.send")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {mine.data && open.length === 0 && !stored ? (
          <Alert tone="info">{t("advances.noneOpen")}</Alert>
        ) : (
          <>
            <FormSelect label={t("advances.advance")} name="advance" value={v.advance ? String(v.advance) : ""} onChange={(e) => setV({ ...v, advance: Number(e.target.value) })} options={open.map((a) => ({ value: String(a.id), label: `${format.number(a.amount, [0, 2])} · ${format.date(a.created_at)} · ${t("advances.balance")} ${format.number(a.balance, [0, 2])}` }))} error={errors.fields.advance} />
            <FormSelect label={t("advances.change")} name="kind" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as AdvanceChangeInput["kind"] })} options={(["postpone", "settle_cash", "settle_payroll"] as const).map((k) => ({ value: k, label: t(`advances.kinds.${k}`) }))} />
            {v.kind !== "settle_cash" && (
              <FormSelect
                label={t(v.kind === "postpone" ? "advances.postponeMonth" : "advances.settleMonth")}
                name="month"
                value={v.month}
                onChange={(e) => setV({ ...v, month: e.target.value })}
                options={(v.kind === "postpone" ? (chosen?.installments ?? []).filter((i) => i.status === "due").map((i) => i.month) : comingMonths()).map((m) => ({ value: m, label: format.date(`${m}-01`, "monthYear") }))}
                error={errors.fields.month}
              />
            )}
            <TextArea label={t("advances.reason")} name="reason" rows={2} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} />
          </>
        )}
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
