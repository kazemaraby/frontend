import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { type Correction, type CorrectionInput, correctionRequests } from "@/api/attendance";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { CheckField, TextArea, TextField } from "@/design/Field";
import { FileDrop } from "@/design/FileDrop";
import { apiErrors } from "@/lib/apiErrors";

/** An attendance correction (Phase 3 task 13): the day's real check-in and / or check-out, the reason and a proof.
 * With `editId` it corrects that returned request and sends it again. */
export function CorrectionDialog({ editId, onClose }: { editId?: number; onClose: () => void }) {
  const { t } = useTranslation();
  const stored = useQuery({ queryKey: ["correction-request", editId], queryFn: () => correctionRequests.get(editId!), enabled: Boolean(editId) });
  if (editId && !stored.data)
    return (
      <Dialog open onClose={onClose} title={t("approvals.editAndResubmit")}>
        {stored.isError ? <Alert>{apiErrors(stored.error, t("common.loadFailed")).general}</Alert> : <p className="text-muted">{t("common.loading")}</p>}
      </Dialog>
    );
  return <CorrectionForm stored={stored.data} onClose={onClose} />;
}

const hhmm = (value: string | null | undefined) => (value ? value.slice(0, 5) : "");

function CorrectionForm({ stored, onClose }: { stored?: Correction; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [v, setV] = useState({
    date: stored?.date ?? "",
    check_in: hhmm(stored?.check_in),
    check_out: hhmm(stored?.check_out),
    out_next_day: stored?.out_next_day ?? false,
    reason: stored?.reason ?? "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ replaces: number; errors: Record<string, string[]> } | null>(null);
  const values: CorrectionInput = { ...v, check_in: v.check_in || null, check_out: v.check_out || null };
  const filled = Boolean(v.date && (v.check_in || v.check_out));

  useEffect(() => {
    if (!filled) return setPreview(null);
    let live = true;
    const timer = window.setTimeout(() => {
      // the reason is checked on sending: a placeholder here keeps its error out of the live check
      correctionRequests
        .preview({ ...v, check_in: v.check_in || null, check_out: v.check_out || null, reason: v.reason || "-" }, stored?.id)
        .then((p) => live && setPreview(p))
        .catch(() => live && setPreview(null));
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [v, filled, stored?.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (!stored) return correctionRequests.create(values, file);
      await correctionRequests.update(stored.id, values, file);
      return correctionRequests.submit(stored.id);
    },
    onSuccess: async () => {
      await Promise.all(["requests", "approvals", "attendance-days"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const first = (field: string) => errors.fields[field] ?? preview?.errors[field]?.[0];
  return (
    <Dialog
      open
      onClose={onClose}
      title={stored ? `${t("approvals.editAndResubmit")} · ${t("selfService.kinds.correction")}` : t("selfService.kinds.correction")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="accent" disabled={!filled || !v.reason.trim() || save.isPending} onClick={() => save.mutate()}>
            {t("approvals.send")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("correction.hint")}</p>
        <DateInput label={t("correction.date")} name="date" value={v.date} onChange={(date) => setV({ ...v, date: date ?? "" })} error={first("date")} hint={t("correction.dateHint")} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("correction.checkIn")} name="check_in" type="time" dir="ltr" value={v.check_in} onChange={(e) => setV({ ...v, check_in: e.target.value })} error={first("check_in")} />
          <TextField label={t("correction.checkOut")} name="check_out" type="time" dir="ltr" value={v.check_out} onChange={(e) => setV({ ...v, check_out: e.target.value })} error={first("check_out")} />
        </div>
        {v.check_out && <CheckField label={t("correction.nextDay")} checked={v.out_next_day} onChange={(e) => setV({ ...v, out_next_day: e.target.checked })} />}
        {preview && !Object.keys(preview.errors).filter((k) => k !== "reason").length && (
          <p role="status" className="text-sm text-muted">
            {t("correction.replaces", { count: preview.replaces })}
          </p>
        )}
        <TextArea label={t("correction.reason")} name="reason" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} error={errors.fields.reason} required />
        <FileDrop label={t("correction.proof")} file={file} onChange={setFile} current={stored?.has_file ? stored.file_name : undefined} error={errors.fields.file} />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
