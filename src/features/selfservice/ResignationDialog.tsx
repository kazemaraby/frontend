import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { type Resignation, type ResignationInput, type ResignationTerms, resignations } from "@/api/resignation";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Dialog } from "@/design/Dialog";
import { CheckField, TextArea, TextField } from "@/design/Field";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

/** The employee's resignation (#65, Phase 4 task 16): the contract's notice and the dates it gives are shown as it is
 * filled in — an indefinite contract's notice (Art. 75), a fixed-term contract resigned without a date (the company
 * sets it, Art. 79 bis), no notice in probation — with the day it counts as accepted and the withdrawal window. */
export function ResignationDialog({ editId, onClose }: { editId?: number; onClose: () => void }) {
  const { t } = useTranslation();
  const stored = useQuery({ queryKey: ["resignation", editId], queryFn: () => resignations.get(editId!), enabled: Boolean(editId) });
  if (editId && !stored.data)
    return (
      <Dialog open onClose={onClose} title={t("approvals.editAndResubmit")}>
        {stored.isError ? <Alert>{apiErrors(stored.error, t("common.loadFailed")).general}</Alert> : <p className="text-muted">{t("common.loading")}</p>}
      </Dialog>
    );
  return <ResignationForm stored={stored.data} onClose={onClose} />;
}

export function TermsLine({ terms }: { terms: ResignationTerms }) {
  const { t } = useTranslation();
  const format = useFormat();
  return (
    <div role="status" className="flex flex-col gap-1 rounded-card bg-teal-soft px-4 py-3 text-sm text-teal-ink">
      <span className="font-semibold">{t(`resignation.kinds.${terms.kind}`)}</span>
      {terms.kind === "indefinite" && <span>{t("resignation.noticeUntil", { n: format.number(terms.notice_days), day: format.date(terms.earliest) })}</span>}
      {terms.kind === "fixed" && <span>{t("resignation.fixedHint", { day: format.date(terms.latest) })}</span>}
      {terms.kind === "probation" && <span>{t("resignation.probationHint")}</span>}
      <span>{t("resignation.acceptedBy", { day: format.date(terms.accepted_by) })}</span>
      <span>{t("resignation.withdrawUntil", { day: format.date(terms.withdraw_until) })}</span>
    </div>
  );
}

function ResignationForm({ stored, onClose }: { stored?: Resignation; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [v, setV] = useState<ResignationInput>({ reason: stored?.reason ?? "", proposed_last_day: stored?.proposed_last_day ?? null });
  const [sure, setSure] = useState(Boolean(stored));
  const [preview, setPreview] = useState<{ terms: ResignationTerms; errors: Record<string, string[]> } | null>(null);
  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      resignations.preview(v, stored?.id).then((p) => live && setPreview(p)).catch(() => live && setPreview(null));
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [v, stored?.id]);
  const send = useMutation({
    mutationFn: async () => {
      if (!stored) return resignations.create(v);
      await resignations.update(stored.id, v);
      return resignations.resubmit(stored.id);
    },
    onSuccess: async () => {
      await Promise.all(["requests", "approvals", "resignations"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onClose();
    },
  });
  const errors = apiErrors(send.error, t("common.saveFailed"));
  const fixed = preview?.terms.kind === "fixed";
  const fieldError = errors.fields.proposed_last_day ?? (v.proposed_last_day ? preview?.errors.proposed_last_day?.[0] : undefined);
  const blocking = errors.fields.detail ?? preview?.errors.detail?.[0];
  return (
    <Dialog
      open
      onClose={onClose}
      title={stored ? `${t("approvals.editAndResubmit")} · ${t("selfService.kinds.resignation")}` : t("selfService.kinds.resignation")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!sure || send.isPending || Boolean(blocking)} onClick={() => send.mutate()}>
            {t("resignation.handIn")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {preview && <TermsLine terms={preview.terms} />}
        {blocking && <Alert>{blocking}</Alert>}
        {!fixed && (
          <TextField
            label={t("resignation.proposedLastDay")}
            name="proposed_last_day"
            type="date"
            value={v.proposed_last_day ?? ""}
            hint={preview ? t("resignation.proposedHint", { day: format.date(preview.terms.default) }) : undefined}
            onChange={(e) => setV({ ...v, proposed_last_day: e.target.value || null })}
            error={fieldError}
          />
        )}
        <TextArea label={t("resignation.reason")} name="reason" rows={3} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} />
        <CheckField label={t("resignation.confirm")} checked={sure} onChange={(e) => setSure(e.target.checked)} />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
