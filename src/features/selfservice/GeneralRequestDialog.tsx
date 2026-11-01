import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api, ApiError, endpoints } from "@/api";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Dialog } from "@/design/Dialog";
import { TextArea, TextField } from "@/design/Field";
import { apiErrors } from "@/lib/apiErrors";

type Stored = { id: number; subject: string; details: string };

/** A free-form request to HR ("طلب عام"). With `editId` it corrects that returned request and sends it again. */
export function GeneralRequestDialog({ editId, onClose }: { editId?: number; onClose: () => void }) {
  const { t } = useTranslation();
  const stored = useQuery({ queryKey: ["general-request", editId], queryFn: () => api.get<Stored>(`/general-requests/${editId}`), enabled: Boolean(editId) });
  if (editId && !stored.data)
    return (
      <Dialog open onClose={onClose} title={t("approvals.editAndResubmit")}>
        {stored.isError ? <Alert>{apiErrors(stored.error, t("common.loadFailed")).general}</Alert> : <p className="text-muted">{t("common.loading")}</p>}
      </Dialog>
    );
  return <GeneralForm stored={stored.data} onClose={onClose} />;
}

function GeneralForm({ stored, onClose }: { stored?: Stored; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState(stored?.subject ?? "");
  const [details, setDetails] = useState(stored?.details ?? "");
  const mutation = useMutation({
    mutationFn: async () => {
      if (!stored) return endpoints.createGeneralRequest({ subject, details });
      await endpoints.updateGeneralRequest(stored.id, { subject, details });
      return endpoints.resubmitGeneralRequest(stored.id);
    },
    onSuccess: async () => {
      await Promise.all(["requests", "approvals"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onClose();
    },
  });
  const noEmployee = mutation.error instanceof ApiError && mutation.error.status === 400;
  return (
    <Dialog
      open
      onClose={onClose}
      title={stored ? `${t("approvals.editAndResubmit")} · ${t("selfService.kinds.general")}` : t("selfService.kinds.general")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="accent" disabled={mutation.isPending || !subject.trim()} onClick={() => mutation.mutate()}>
            {t("approvals.send")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label={t("approvals.subject")} name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required autoFocus />
        <TextArea label={t("approvals.details")} name="details" value={details} onChange={(e) => setDetails(e.target.value)} />
        {mutation.isError && <Alert>{noEmployee ? t("approvals.noEmployee") : apiErrors(mutation.error, t("common.saveFailed")).general}</Alert>}
      </div>
    </Dialog>
  );
}
