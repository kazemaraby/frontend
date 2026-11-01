import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { type OvertimePreview, type OvertimeStored, overtimeRequests } from "@/api/attendance";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { CheckField, TextArea, TextField } from "@/design/Field";
import { hm } from "@/features/attendance/clock";
import { apiErrors } from "@/lib/apiErrors";

/** An overtime request (Phase 3 task 14): time outside the shift on a day, before or after it. Only approved overtime
 * counts (decision 2). With `editId` it corrects that returned request and sends it again. */
export function OvertimeDialog({ editId, onClose }: { editId?: number; onClose: () => void }) {
  const { t } = useTranslation();
  const stored = useQuery({ queryKey: ["overtime-request", editId], queryFn: () => overtimeRequests.get(editId!), enabled: Boolean(editId) });
  if (editId && !stored.data)
    return (
      <Dialog open onClose={onClose} title={t("approvals.editAndResubmit")}>
        {stored.isError ? <Alert>{apiErrors(stored.error, t("common.loadFailed")).general}</Alert> : <p className="text-muted">{t("common.loading")}</p>}
      </Dialog>
    );
  return <OvertimeForm stored={stored.data} onClose={onClose} />;
}

function OvertimeForm({ stored, onClose }: { stored?: OvertimeStored; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [v, setV] = useState({
    date: stored?.date ?? "",
    from_time: stored?.from_time.slice(0, 5) ?? "",
    to_time: stored?.to_time.slice(0, 5) ?? "",
    to_next_day: stored?.to_next_day ?? false,
    reason: stored?.reason ?? "",
  });
  const [preview, setPreview] = useState<OvertimePreview | null>(null);
  const filled = Boolean(v.date && v.from_time && v.to_time);

  useEffect(() => {
    if (!filled) return setPreview(null);
    let live = true;
    const timer = window.setTimeout(() => {
      // the reason is checked on sending: a placeholder keeps its error out of the live check
      overtimeRequests
        .preview({ ...v, reason: v.reason || "-" }, stored?.id)
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
      if (!stored) return overtimeRequests.create(v);
      await overtimeRequests.update(stored.id, v);
      return overtimeRequests.submit(stored.id);
    },
    onSuccess: async () => {
      await Promise.all(["requests", "approvals", "attendance-days"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const first = (field: string) => errors.fields[field] ?? preview?.errors[field]?.[0];
  const clean = preview && !Object.keys(preview.errors).filter((k) => k !== "reason").length;
  return (
    <Dialog
      open
      onClose={onClose}
      title={stored ? `${t("approvals.editAndResubmit")} · ${t("selfService.kinds.overtime")}` : t("selfService.kinds.overtime")}
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
        <p className="text-sm text-muted">{t("overtimeRequest.hint")}</p>
        <DateInput label={t("correction.date")} name="date" value={v.date} onChange={(date) => setV({ ...v, date: date ?? "" })} error={first("date")} hint={t("correction.dateHint")} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("overtimeRequest.from")} name="from_time" type="time" dir="ltr" value={v.from_time} onChange={(e) => setV({ ...v, from_time: e.target.value })} error={first("from_time")} required />
          <TextField label={t("overtimeRequest.to")} name="to_time" type="time" dir="ltr" value={v.to_time} onChange={(e) => setV({ ...v, to_time: e.target.value })} error={first("to_time")} required />
        </div>
        <CheckField label={t("overtimeRequest.nextDay")} checked={v.to_next_day} onChange={(e) => setV({ ...v, to_next_day: e.target.checked })} />
        {clean && preview.minutes > 0 && (
          <p role="status" className="num text-sm text-muted">
            {t("overtimeRequest.counted", { hours: hm(preview.minutes), kind: t(`record.overtimeKinds.${preview.day_type}`) })}
            {preview.year_left_minutes !== undefined && ` · ${t("overtimeRequest.yearLeft", { hours: hm(preview.year_left_minutes) })}`}
          </p>
        )}
        <TextArea label={t("correction.reason")} name="reason" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} error={errors.fields.reason} required />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
