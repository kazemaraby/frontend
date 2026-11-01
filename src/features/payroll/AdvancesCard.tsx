import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { Employee } from "@/api";
import { type Advance, advances } from "@/api/payroll";
import { useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { Dialog } from "@/design/Dialog";
import { FormSelect, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { Pill } from "@/design/Pill";
import { useComposer } from "@/features/selfservice/composer";
import { apiErrors } from "@/lib/apiErrors";
import { toISODate } from "@/lib/format";
import { useFormat } from "@/lib/useFormat";

const STATUS_TONES = { due: "amber", deducted: "green", settled: "teal" } as const;

/** The employee's advances (Phase 4 task 9) in their file's salary tab: each with its schedule and what is left.
 * Payroll pays one out, postpones an installment, settles the rest or enters one; the employee asks for a change. */
export function AdvancesCard({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  const { can, me } = useSession();
  const queryClient = useQueryClient();
  const manage = can("payroll.manage");
  const own = me?.employee?.id === employee.id;
  const list = useQuery({
    queryKey: ["advances", employee.id, own && !can("payroll.view")],
    queryFn: () => (can("payroll.view") ? advances.list(employee.id) : advances.mine()),
    enabled: can("payroll.view") || own,
  });
  const { open, kinds } = useComposer();
  const [adding, setAdding] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["advances"] });
  const act = useMutation({
    mutationFn: ({ fn }: { fn: () => Promise<unknown> }) => fn(),
    onSuccess: () => Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ["employee-pay", employee.id] })]),
  });
  const errors = apiErrors(act.error, t("common.saveFailed"));
  if (!list.data) return null;
  return (
    <Card
      variant="solid"
      title={t("advances.title")}
      subtitle={t("advances.hint")}
      action={
        <span className="flex flex-wrap gap-2">
          {manage && (
            <Link to="/payroll/import-advances" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 text-sm text-ink hover:bg-neutral-soft">
              <FileSpreadsheet className="size-4" /> {t("advances.import")}
            </Link>
          )}
          {manage && (
            <Button size="sm" variant="accent" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
              {t("advances.add")}
            </Button>
          )}
          {own && kinds.includes("advance") && (
            <Button size="sm" variant="outline" onClick={() => open("advance")}>
              {t("selfService.kinds.advance")}
            </Button>
          )}
        </span>
      }
    >
      {errors.general || errors.fields.month || errors.fields.detail ? <Alert className="mb-3">{errors.fields.month ?? errors.fields.detail ?? errors.general}</Alert> : null}
      {list.data.length === 0 ? (
        <p className="text-muted">{t("advances.none")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {list.data.map((a) => (
            <AdvanceItem key={a.id} advance={a} manage={manage} own={own && kinds.includes("advance_change")} busy={act.isPending} onAct={(fn) => act.mutate({ fn })} onChange={() => open("advance_change")} />
          ))}
        </div>
      )}
      {adding && <NewAdvanceDialog employee={employee} onClose={() => setAdding(false)} onSaved={refresh} />}
    </Card>
  );
}

function AdvanceItem({ advance, manage, own, busy, onAct, onChange }: { advance: Advance; manage: boolean; own: boolean; busy: boolean; onAct: (fn: () => Promise<unknown>) => void; onChange: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const due = advance.installments.filter((i) => i.status === "due");
  const open = Number(advance.balance) > 0;
  return (
    <section aria-label={t("advances.itemLabel", { amount: format.number(advance.amount, [0, 2]) })} className="rounded-card border border-line p-4">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <Money amount={advance.amount} fractionDigits={[0, 2]} className="text-lg font-semibold" />
        <Pill tone="neutral">{t(`advances.sources.${advance.source}`)}</Pill>
        {advance.paid_on ? <Pill tone="green">{t("advances.paidOn", { date: format.date(advance.paid_on) })}</Pill> : <Pill tone="amber">{t("advances.notPaid")}</Pill>}
        <span className="ms-auto text-sm">
          {t("advances.balance")} <Money amount={advance.balance} fractionDigits={[2, 2]} className="font-semibold" />
        </span>
      </header>
      {advance.reason && <p className="mb-2 text-sm text-muted">{advance.reason}</p>}
      <ul className="flex flex-wrap gap-2">
        {advance.installments.map((i) => (
          <li key={i.id} className="flex items-center gap-2 rounded-full bg-neutral-soft px-3 py-1 text-sm">
            <span className="num">{format.date(`${i.month}-01`, "monthYear")}</span>
            <Money amount={i.amount} fractionDigits={[0, 2]} />
            <Pill tone={STATUS_TONES[i.status]}>{t(`advances.statuses.${i.status}`)}</Pill>
          </li>
        ))}
      </ul>
      {(manage || own) && open && (
        <div className="mt-3 flex flex-wrap gap-2">
          {manage && !advance.paid_on && (
            <Button size="sm" disabled={busy} onClick={() => onAct(() => advances.pay(advance.id, toISODate(new Date())))}>
              {t("advances.pay")}
            </Button>
          )}
          {manage && due[0] && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onAct(() => advances.postpone(advance.id, due[0].month))}>
              {t("advances.postponeNext", { month: format.date(`${due[0].month}-01`, "monthYear") })}
            </Button>
          )}
          {manage && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onAct(() => advances.settle(advance.id, "cash"))}>
              {t("advances.settleCash")}
            </Button>
          )}
          {own && !manage && (
            <Button size="sm" variant="outline" onClick={onChange}>
              {t("selfService.kinds.advance_change")}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function NewAdvanceDialog({ employee, onClose, onSaved }: { employee: Employee; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const { t } = useTranslation();
  const day = new Date();
  const [v, setV] = useState({ amount: "", installments: "6", first_month: toISODate(new Date(day.getFullYear(), day.getMonth() + 1, 1)).slice(0, 7), reason: "", paid: "yes" });
  const save = useMutation({
    mutationFn: () => advances.create({ employee: employee.id, amount: v.amount, installments: Number(v.installments), first_month: v.first_month, reason: v.reason, paid_on: v.paid === "yes" ? toISODate(new Date()) : null }),
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("advances.add")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!v.amount || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label={t("advances.amount")} name="amount" dir="ltr" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} error={errors.fields.amount} />
          <TextField label={t("advances.installments")} name="installments" dir="ltr" inputMode="numeric" value={v.installments} onChange={(e) => setV({ ...v, installments: e.target.value })} />
          <TextField label={t("advances.firstMonth")} name="first_month" type="month" value={v.first_month} onChange={(e) => setV({ ...v, first_month: e.target.value })} />
        </div>
        <FormSelect label={t("advances.paidOut")} name="paid" value={v.paid} onChange={(e) => setV({ ...v, paid: e.target.value })} options={[{ value: "yes", label: t("advances.paidToday") }, { value: "no", label: t("advances.notPaid") }]} />
        <TextField label={t("advances.reason")} name="reason" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} />
        <Alert tone="info">{t("advances.manualNote")}</Alert>
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
