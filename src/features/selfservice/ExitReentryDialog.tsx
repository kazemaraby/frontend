import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { type ExitReentryBody, type ExitReentryPreview, exitReentryApi } from "@/api/compliance";
import { hr } from "@/api/hr";
import { leave } from "@/api/leave";
import { useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextArea } from "@/design/Field";
import { Money } from "@/design/Money";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const EMPTY: ExitReentryBody = { kind: "exit_reentry_single", leave_on: "", back_on: "", dependents: [], leave_request: null, reason: "", pay_via: "payroll", consent: false };

/** An exit re-entry visa (Phase 5 task 10, #63): always approved; who pays (the company's one a year, the
 * employee's after that) and the fee show while the form is filled in. `?leave=<id>` fills it from a leave request
 * ("travelling abroad" on the leave form). With `editId` it corrects that returned request and sends it again. */
export function ExitReentryDialog({ editId, onClose }: { editId?: number; onClose: () => void }) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const leaveId = Number(params.get("leave")) || null;
  const stored = useQuery({ queryKey: ["exit-reentry", editId], queryFn: () => exitReentryApi.get(editId!), enabled: Boolean(editId) });
  const fromLeave = useQuery({ queryKey: ["leave", "request", leaveId], queryFn: () => leave.request(leaveId!), enabled: Boolean(leaveId) && !editId });
  const close = () => {
    if (leaveId) {
      const next = new URLSearchParams(params);
      next.delete("leave");
      setParams(next, { replace: true });
    }
    onClose();
  };
  if ((editId && !stored.data) || (leaveId && !editId && !fromLeave.data && !fromLeave.isError))
    return (
      <Dialog open onClose={close} title={t("selfService.kinds.exit_reentry")}>
        {stored.isError ? <Alert>{apiErrors(stored.error, t("common.loadFailed")).general}</Alert> : <p className="text-muted">{t("common.loading")}</p>}
      </Dialog>
    );
  const initial: ExitReentryBody = stored.data
    ? { kind: stored.data.kind, leave_on: stored.data.leave_on, back_on: stored.data.back_on, dependents: stored.data.dependents, leave_request: stored.data.leave_request, reason: stored.data.reason, pay_via: stored.data.pay_via, consent: stored.data.consent }
    : fromLeave.data
      ? { ...EMPTY, leave_on: fromLeave.data.start_date, back_on: fromLeave.data.end_date, leave_request: fromLeave.data.id }
      : EMPTY;
  return <ExitReentryForm editId={editId} initial={initial} onClose={close} />;
}

function ExitReentryForm({ editId, initial, onClose }: { editId?: number; initial: ExitReentryBody; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const { me } = useSession();
  const [v, setV] = useState<ExitReentryBody>(initial);
  const [preview, setPreview] = useState<ExitReentryPreview | null>(null);
  const family = useQuery({ queryKey: ["my-dependents", me?.employee?.id], queryFn: () => hr.dependents(me!.employee!.id), enabled: Boolean(me?.employee) });
  const filled = Boolean(v.leave_on && v.back_on);

  useEffect(() => {
    if (!filled) return setPreview(null);
    let live = true;
    const timer = window.setTimeout(() => {
      exitReentryApi
        .preview(v, editId)
        .then((p) => live && setPreview(p))
        .catch(() => live && setPreview(null));
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [v, filled, editId]);

  const save = useMutation({
    mutationFn: async () => {
      if (!editId) return exitReentryApi.create(v);
      await exitReentryApi.update(editId, v);
      return exitReentryApi.resubmit(editId);
    },
    onSuccess: async () => {
      await Promise.all(["requests", "selfservice", "approvals", "exit-reentry"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const shown = (name: string) => errors.fields[name] ?? preview?.errors?.[name]?.[0];
  const employeePays = preview?.payer === "employee";
  const detail = preview?.fee_detail;
  const toggle = (id: number, on: boolean) => setV({ ...v, dependents: on ? [...v.dependents, id] : v.dependents.filter((d) => d !== id) });
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={editId ? `${t("approvals.editAndResubmit")} · ${t("selfService.kinds.exit_reentry")}` : t("selfService.kinds.exit_reentry")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="accent" disabled={save.isPending || !filled || (employeePays && v.pay_via === "payroll" && !v.consent)} onClick={() => save.mutate()}>
            {t("approvals.send")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormSelect label={t("exitReentry.kind")} name="kind" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as ExitReentryBody["kind"] })} options={(["exit_reentry_single", "exit_reentry_multiple"] as const).map((k) => ({ value: k, label: t(`muqeem.kinds.${k}`) }))} />
          <DateInput label={t("exitReentry.leaveOn")} name="leave_on" value={v.leave_on || null} onChange={(d) => setV({ ...v, leave_on: d ?? "" })} error={shown("leave_on")} />
          <DateInput label={t("exitReentry.backOn")} name="back_on" value={v.back_on || null} onChange={(d) => setV({ ...v, back_on: d ?? "" })} error={shown("back_on")} />
        </div>
        {(family.data?.length ?? 0) > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-ink">{t("exitReentry.family")}</legend>
            {family.data!.map((d) => (
              <CheckField key={d.id} label={format.name(d)} checked={v.dependents.includes(d.id)} onChange={(e) => toggle(d.id, e.target.checked)} />
            ))}
            {shown("dependents") && <p className="text-sm text-danger">{shown("dependents")}</p>}
          </fieldset>
        )}
        <TextArea label={t("exitReentry.reason")} name="reason" rows={2} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} />
        {preview && preview.payer && (
          <div className="rounded-card bg-neutral-soft p-4 text-sm">
            <p className="font-medium">{t(preview.payer === "company" ? "exitReentry.companyPays" : "exitReentry.employeePays")}</p>
            {preview.fee && (
              <p className="mt-1 flex flex-wrap items-center gap-x-2">
                {t("exitReentry.fee")} <Money amount={preview.fee} />
                {detail?.months != null && <span className="text-muted">{t("exitReentry.feeDetail", { months: detail.months, travellers: detail.travellers ?? 1 })}</span>}
              </p>
            )}
          </div>
        )}
        {employeePays && (
          <div className="flex flex-col gap-3">
            <FormSelect label={t("exitReentry.payVia")} name="pay_via" value={v.pay_via} onChange={(e) => setV({ ...v, pay_via: e.target.value as ExitReentryBody["pay_via"] })} options={(["payroll", "direct"] as const).map((p) => ({ value: p, label: t(`exitReentry.payVias.${p}`) }))} />
            {v.pay_via === "payroll" && <CheckField label={t("exitReentry.consent")} checked={v.consent} onChange={(e) => setV({ ...v, consent: e.target.checked })} />}
          </div>
        )}
        {(errors.fields.detail || errors.fields.consent || errors.general || preview?.errors?.detail) && <Alert>{errors.fields.detail ?? errors.fields.consent ?? errors.general ?? preview?.errors?.detail?.[0]}</Alert>}
      </div>
    </Dialog>
  );
}
