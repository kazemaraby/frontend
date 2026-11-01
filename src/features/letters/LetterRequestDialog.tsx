import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type LetterLanguage, letters } from "@/api/letters";
import { useScopeKey } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Dialog } from "@/design/Dialog";
import { FormSelect, TextArea, TextField } from "@/design/Field";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

export const LANGUAGES: LetterLanguage[] = ["ar", "en", "both"];

type Values = { template: string; language: LetterLanguage; addressee: string; purpose: string };
const EMPTY: Values = { template: "", language: "ar", addressee: "", purpose: "" };

/** Ask HR for a letter (salary certificate, employment certificate…): the approval issues the PDF. With `editId`
 * it corrects that returned request and sends it again. */
export function LetterRequestDialog({ editId, onClose }: { editId?: number; onClose: () => void }) {
  const { t } = useTranslation();
  const stored = useQuery({ queryKey: ["letters", "request", editId], queryFn: () => letters.askedFor(editId!), enabled: Boolean(editId) });
  if (editId && !stored.data)
    return (
      <Dialog open onClose={onClose} title={t("approvals.editAndResubmit")}>
        {stored.isError ? <Alert>{apiErrors(stored.error, t("common.loadFailed")).general}</Alert> : <p className="text-muted">{t("common.loading")}</p>}
      </Dialog>
    );
  const initial = stored.data ? { template: String(stored.data.template), language: stored.data.language, addressee: stored.data.addressee, purpose: stored.data.purpose } : EMPTY;
  return <LetterForm editId={editId} initial={initial} onClose={onClose} />;
}

function LetterForm({ editId, initial, onClose }: { editId?: number; initial: Values; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const templates = useQuery({ queryKey: ["letters", "templates", "active", ...scope], queryFn: () => letters.templates(true) });
  const [v, setV] = useState<Values>(initial);
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) => setV((x) => ({ ...x, [key]: value }));
  const chosen = (templates.data ?? []).find((x) => String(x.id) === v.template);
  const save = useMutation({
    mutationFn: async () => {
      const body = { ...v, template: Number(v.template) };
      if (!editId) return letters.ask(body);
      await letters.updateAsk(editId, body);
      return letters.resubmitAsk(editId);
    },
    onSuccess: async () => {
      await Promise.all(["requests", "approvals", "letters"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={editId ? `${t("approvals.editAndResubmit")} · ${t("letters.ask")}` : t("letters.ask")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="accent" disabled={!v.template || save.isPending} onClick={() => save.mutate()}>
            {t("approvals.send")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormSelect
          label={t("letters.letter")}
          name="template"
          value={v.template}
          placeholder={t("common.choose")}
          options={(templates.data ?? []).map((x) => ({ value: String(x.id), label: format.pick({ ar: x.name_ar, en: x.name_en || x.name_ar }) }))}
          onChange={(e) => set("template", e.target.value)}
          error={errors.fields.template}
          required
        />
        {chosen?.shows_salary && <p className="text-sm text-muted">{t("letters.showsSalary")}</p>}
        <FormSelect label={t("letters.language")} name="language" value={v.language} onChange={(e) => set("language", e.target.value as LetterLanguage)} options={LANGUAGES.map((l) => ({ value: l, label: t(`letters.languages.${l}`) }))} />
        <TextField label={t("letters.addressee")} name="addressee" value={v.addressee} onChange={(e) => set("addressee", e.target.value)} hint={t("letters.addresseeHint")} error={errors.fields.addressee} />
        <TextArea label={t("letters.purpose")} name="purpose" rows={2} value={v.purpose} onChange={(e) => set("purpose", e.target.value)} />
        {(errors.general || errors.fields.detail) && <Alert>{errors.general ?? errors.fields.detail}</Alert>}
      </div>
    </Dialog>
  );
}
