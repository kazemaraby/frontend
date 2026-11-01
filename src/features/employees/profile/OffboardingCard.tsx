import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, FileSignature, RotateCcw, UserCheck, X } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Employee } from "@/api";
import { exitReentryApi } from "@/api/compliance";
import { runs, type SettlementOptions } from "@/api/payroll";
import { type ClearanceItem, type Offboarding, type Resignation, resignations } from "@/api/resignation";
import { useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextArea, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { Pill, type PillTone } from "@/design/Pill";
import { TermsLine } from "@/features/selfservice/ResignationDialog";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const OFFBOARDING_TONES: Record<Offboarding["status"], PillTone> = { notice: "amber", left: "salmon", settled: "neutral", cancelled: "neutral" };

/** HR's view of an employee on the way out (Phase 4 task 16): a resignation waiting for approval — its notice, and
 * the last working day HR may set (a shorter notice waives the rest; a fixed-term one put off needs a reason) — and
 * the offboarding once approved: the last working day and what the clearance will ask for (custody, advances). */
export function OffboardingCard({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["resignations", employee.id], queryFn: () => resignations.of(employee.id) });
  const offboardings = useQuery({ queryKey: ["offboardings", employee.id], queryFn: () => resignations.offboardings({ employee: employee.id }) });
  const [dating, setDating] = useState<Resignation | null>(null);
  const [keeping, setKeeping] = useState<Offboarding | null>(null);
  const [settling, setSettling] = useState<Offboarding | null>(null);
  const [starting, setStarting] = useState(false);
  const { can } = useSession();
  const waiting = (list.data ?? []).find((r) => r.status === "pending");
  const current = (offboardings.data ?? []).find((o) => o.status !== "cancelled");
  const left = employee.status === "terminated" || employee.status === "contract_ended";
  if (!waiting && !current) {
    if (!left || offboardings.isPending) return null;
    return (
      <Card variant="solid" title={t("offboarding.title")} subtitle={t("offboarding.startHint")} action={<Button size="sm" variant="accent" onClick={() => setStarting(true)}>{t("offboarding.start")}</Button>}>
        {starting && <StartOffboardingDialog employee={employee} onClose={() => setStarting(false)} />}
      </Card>
    );
  }
  const refresh = () => Promise.all(["resignations", "offboardings", "approvals"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
  return (
    <Card variant="solid" title={t("offboarding.title")}>
      <div className="flex flex-col gap-4">
        {waiting && (
          <section aria-label={t("offboarding.waiting")} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">
                <Pill tone="amber">{t("offboarding.waiting")}</Pill>
                <span className="num ms-2">{t("offboarding.handedIn", { day: format.date(waiting.given_on) })}</span>
                {waiting.last_working_day && <span className="num ms-2 font-semibold">{t("offboarding.lastDay", { day: format.date(waiting.last_working_day) })}</span>}
              </span>
              <Button size="sm" variant="outline" icon={<CalendarClock className="size-4" />} onClick={() => setDating(waiting)}>
                {t("offboarding.setLastDay")}
              </Button>
            </div>
            <TermsLine terms={waiting.terms} />
            {waiting.reason && <p className="text-sm text-muted">{waiting.reason}</p>}
          </section>
        )}
        {current && (
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">
                <Pill tone={OFFBOARDING_TONES[current.status]}>{t(`offboarding.statuses.${current.status}`)}</Pill>
                <span className="num ms-2 font-semibold">{t("offboarding.lastDay", { day: format.date(current.last_working_day) })}</span>
              </span>
              <span className="flex flex-wrap gap-2">
                {current.status === "notice" && (
                  <Button size="sm" variant="outline" icon={<UserCheck className="size-4" />} onClick={() => setKeeping(current)}>
                    {t("offboarding.keep")}
                  </Button>
                )}
                {current.settlement ? (
                  <Link className="text-sm font-semibold text-teal-dark underline" to={`/payroll?month=${current.settlement.month}&run=${current.settlement.id}`}>
                    {t("settlement.open")}
                  </Link>
                ) : (
                  can("payroll.manage") && (
                    <Button size="sm" icon={<FileSignature className="size-4" />} onClick={() => setSettling(current)}>
                      {t("settlement.prepare")}
                    </Button>
                  )
                )}
              </span>
            </div>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted">{t("offboarding.custodyOpen")}</dt>
                <dd className="num font-semibold">{format.number(current.outstanding.custody_open)}</dd>
              </div>
              <div>
                <dt className="text-muted">{t("offboarding.custodyCash")}</dt>
                <dd><Money amount={current.outstanding.custody_cash} fractionDigits={[0, 2]} /></dd>
              </div>
              <div>
                <dt className="text-muted">{t("offboarding.shortfall")}</dt>
                <dd><Money amount={current.outstanding.custody_shortfall} fractionDigits={[0, 2]} /></dd>
              </div>
              <div>
                <dt className="text-muted">{t("offboarding.advanceBalance")}</dt>
                <dd><Money amount={current.outstanding.advance_balance} fractionDigits={[0, 2]} /></dd>
              </div>
            </dl>
            <ClearanceList offboarding={current} onDone={refresh} />
            {current.government?.applies && <GovernmentSteps offboarding={current} onDone={refresh} />}
          </section>
        )}
      </div>
      {dating && <LastDayDialog resignation={dating} onDone={refresh} onClose={() => setDating(null)} />}
      {keeping && <KeepDialog offboarding={keeping} onDone={refresh} onClose={() => setKeeping(null)} />}
      {settling && <SettleDialog offboarding={settling} onClose={() => setSettling(null)} />}
    </Card>
  );
}

function LastDayDialog({ resignation, onDone, onClose }: { resignation: Resignation; onDone: () => Promise<unknown>; onClose: () => void }) {
  const { t } = useTranslation();
  const [day, setDay] = useState(resignation.last_working_day ?? resignation.terms.default);
  const [reason, setReason] = useState(resignation.postpone_reason);
  const save = useMutation({
    mutationFn: () => resignations.setLastDay(resignation.id, { last_working_day: day, postpone_reason: reason }),
    onSuccess: async () => {
      await onDone();
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const fixed = resignation.terms.kind === "fixed";
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("offboarding.setLastDay")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!day || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t(fixed ? "offboarding.fixedRule" : "offboarding.noticeRule", { day: resignation.terms.latest, accepted: resignation.terms.accepted_by })}</p>
        <TextField label={t("offboarding.lastWorkingDay")} name="last_working_day" type="date" min={resignation.given_on} max={resignation.terms.latest} value={day} onChange={(e) => setDay(e.target.value)} error={errors.fields.last_working_day} />
        {fixed && <TextArea label={t("offboarding.postponeReason")} name="postpone_reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} error={errors.fields.postpone_reason} />}
        {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

function KeepDialog({ offboarding, onDone, onClose }: { offboarding: Offboarding; onDone: () => Promise<unknown>; onClose: () => void }) {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  const keep = useMutation({
    mutationFn: () => resignations.keep(offboarding.id, note),
    onSuccess: async () => {
      await onDone();
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("offboarding.keep")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!note.trim() || keep.isPending} onClick={() => keep.mutate()}>
            {t("offboarding.keepConfirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("offboarding.keepHint")}</p>
        <TextArea label={t("offboarding.keepNote")} name="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        {keep.isError && <Alert>{apiErrors(keep.error, t("common.saveFailed")).general}</Alert>}
      </div>
    </Dialog>
  );
}

/** The clearance (#46): each area signs off, or isn't needed (with the reason); who signed and when. The final
 * settlement is approved only once every area is done and no custody is still held. */
function ClearanceList({ offboarding, onDone }: { offboarding: Offboarding; onDone: () => Promise<unknown> }) {
  const { t } = useTranslation();
  const format = useFormat();
  const [waiving, setWaiving] = useState<ClearanceItem | null>(null);
  const sign = useMutation({ mutationFn: (body: { item: ClearanceItem; status: ClearanceItem["status"]; note?: string }) => resignations.sign(offboarding.id, { area: body.item.area, status: body.status, note: body.note ?? "" }), onSuccess: onDone });
  const errors = apiErrors(sign.error, t("common.saveFailed"));
  const open = offboarding.status === "notice" || offboarding.status === "left";
  const TONES = { open: "amber", cleared: "green", waived: "neutral" } as const;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{t("clearance.title")}</h3>
      <ul className="flex flex-col gap-1">
        {offboarding.clearance.map((item) => (
          <li key={item.area} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-1.5 text-sm">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{t(`clearance.areas.${item.area}`)}</span>
              <Pill tone={TONES[item.status]}>{t(`clearance.statuses.${item.status}`)}</Pill>
              {item.cleared_by_name && <span className="text-xs text-muted">{t("clearance.by", { name: format.name({ name_ar: item.cleared_by_name.ar, name_en: item.cleared_by_name.en }), day: item.cleared_at ? format.date(item.cleared_at) : "" })}</span>}
              {item.note && <span className="text-xs text-muted">· {item.note}</span>}
            </span>
            {open && (
              <span className="flex gap-1">
                {item.status === "open" ? (
                  <>
                    <Button size="sm" variant="outline" icon={<Check className="size-4" />} disabled={sign.isPending} onClick={() => sign.mutate({ item, status: "cleared" })}>
                      {t("clearance.sign")}
                    </Button>
                    <Button size="sm" variant="ghost" icon={<X className="size-4" />} disabled={sign.isPending} onClick={() => setWaiving(item)}>
                      {t("clearance.waive")}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" icon={<RotateCcw className="size-4" />} disabled={sign.isPending} onClick={() => sign.mutate({ item, status: "open" })}>
                    {t("clearance.reopen")}
                  </Button>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
      {(errors.fields.detail || errors.general) && !waiving && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      {waiving && <WaiveDialog item={waiving} onSave={(note) => sign.mutateAsync({ item: waiving, status: "waived", note })} onClose={() => setWaiving(null)} />}
    </div>
  );
}

/** A non-Saudi's government steps (Phase 5 task 10, decision 10): the final exit visa (or a transfer of service
 * instead) and the iqama cancelled or handed over. Warnings only: the final settlement doesn't wait for them. */
function GovernmentSteps({ offboarding, onDone }: { offboarding: Offboarding; onDone: () => Promise<unknown> }) {
  const { t } = useTranslation();
  const { can } = useSession();
  const steps = offboarding.government!;
  const save = useMutation({ mutationFn: (body: { transfer_of_service?: boolean; iqama_cancelled?: boolean }) => exitReentryApi.saveGovernment(offboarding.id, body), onSuccess: onDone });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const mayChange = can("employees.change_status") && (offboarding.status === "notice" || offboarding.status === "left");
  return (
    <section aria-label={t("offboarding.government")} className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{t("offboarding.government")}</h3>
      {steps.warnings.map((w) => (
        <Alert key={w} tone="warning">
          {w}
        </Alert>
      ))}
      {steps.warnings.length > 0 && <p className="text-xs text-muted">{t("offboarding.governmentHint")}</p>}
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <CheckField label={t("offboarding.transferOfService")} checked={steps.transfer_of_service} disabled={!mayChange || save.isPending} onChange={(e) => save.mutate({ transfer_of_service: e.target.checked })} />
        <CheckField label={t("offboarding.iqamaCancelled")} checked={steps.iqama_cancelled} disabled={!mayChange || save.isPending} onChange={(e) => save.mutate({ iqama_cancelled: e.target.checked })} />
      </div>
      {save.isError && <Alert>{errors.general}</Alert>}
    </section>
  );
}

function WaiveDialog({ item, onSave, onClose }: { item: ClearanceItem; onSave: (note: string) => Promise<unknown>; onClose: () => void }) {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  const save = useMutation({ mutationFn: () => onSave(note), onSuccess: onClose });
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${t("clearance.waive")} · ${t(`clearance.areas.${item.area}`)}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!note.trim() || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <TextArea label={t("clearance.why")} name="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
    </Dialog>
  );
}

/** Preparing the final settlement (#100): what HR states for the case — Art. 87, Art. 77, the notice not served
 * (Art. 76) and who didn't serve it — then the settlement run is made and worked out, and opened in the payroll. */
function SettleDialog({ offboarding, onClose }: { offboarding: Offboarding; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [v, setV] = useState<SettlementOptions>({ full_award: "", event_date: null, unfair: false, notice_days: 0, notice_by: "employer" });
  const make = useMutation({
    mutationFn: async () => {
      const run = await runs.settle(offboarding.employee, v);
      await runs.calculate(run.id);
      return run;
    },
    onSuccess: (run) => navigate(`/payroll?month=${run.month}&currency=${run.currency}&run=${run.id}`),
  });
  const errors = apiErrors(make.error, t("common.saveFailed"));
  const resigned = offboarding.reason === "resignation";
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("settlement.prepare")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={make.isPending} onClick={() => make.mutate()}>
            {t("settlement.make")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("settlement.makeHint")}</p>
        {resigned && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormSelect label={t("eosb.fullAward")} name="full_award" value={v.full_award} onChange={(e) => setV({ ...v, full_award: e.target.value as SettlementOptions["full_award"] })} options={[{ value: "", label: t("eosb.art87.none") }, ...["marriage", "childbirth", "force_majeure"].map((k) => ({ value: k, label: t(`eosb.art87.${k}`) }))]} />
            {(v.full_award === "marriage" || v.full_award === "childbirth") && <TextField label={t("eosb.eventDate")} name="event_date" type="date" value={v.event_date ?? ""} onChange={(e) => setV({ ...v, event_date: e.target.value || null })} />}
          </div>
        )}
        {!resigned && <CheckField label={t("eosb.unfair")} checked={v.unfair} onChange={(e) => setV({ ...v, unfair: e.target.checked })} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("eosb.noticeUnserved")} name="notice_days" dir="ltr" inputMode="numeric" value={v.notice_days ? String(v.notice_days) : ""} onChange={(e) => setV({ ...v, notice_days: Number(e.target.value) || 0 })} />
          {v.notice_days > 0 && <FormSelect label={t("settlement.noticeBy")} name="notice_by" value={v.notice_by} onChange={(e) => setV({ ...v, notice_by: e.target.value as SettlementOptions["notice_by"] })} options={[{ value: "employer", label: t("settlement.noticeByEmployer") }, { value: "employee", label: t("settlement.noticeByEmployee") }]} />}
        </div>
        {(errors.fields.employee || errors.fields.detail || errors.general) && <Alert>{errors.fields.employee ?? errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

const ENDINGS = ["termination_by_employer", "mutual_agreement", "dismissal", "probation_not_passed", "retirement", "death", "resignation", "other"];

/** HR starts an offboarding for an ending other than a resignation handed in through the system: the reason and the
 * last working day (one who already left: their termination date). The clearance checklist starts with it. */
export function StartOffboardingDialog({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const left = employee.status === "terminated" || employee.status === "contract_ended";
  const [v, setV] = useState({ reason: "termination_by_employer", last_working_day: "", note: "" });
  const start = useMutation({
    mutationFn: () => resignations.start({ employee: employee.id, reason: v.reason, last_working_day: v.last_working_day || null, note: v.note }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["offboardings"] });
      // a list fetched before the new one was saved mustn't hide it
      queryClient.setQueryData<Offboarding[]>(["offboardings", employee.id], (old) => (old?.some((o) => o.id === created.id) ? old : [created, ...(old ?? [])]));
      onClose();
    },
  });
  const errors = apiErrors(start.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("offboarding.start")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={start.isPending || (!left && !v.last_working_day)} onClick={() => start.mutate()}>
            {t("offboarding.start")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormSelect label={t("eosb.reason")} name="reason" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} options={ENDINGS.map((r) => ({ value: r, label: t(`eosb.reasons.${r}`) }))} error={errors.fields.reason} />
        {!left && <TextField label={t("offboarding.lastWorkingDay")} name="last_working_day" type="date" value={v.last_working_day} onChange={(e) => setV({ ...v, last_working_day: e.target.value })} error={errors.fields.last_working_day} />}
        <TextArea label={t("offboarding.note")} name="note" rows={2} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
        {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
