import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type Dependent, type DocumentType, formData, hr } from "@/api/hr";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { FileDrop } from "@/design/FileDrop";
import { FormSelect, TextField } from "@/design/Field";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

export type DocumentDraft = {
  document_type: string;
  dependent: string;
  number: string;
  issue_date: string | null;
  expiry_date: string | null;
  issue_place: string;
  file: File | null;
};

export const emptyDocument = (): DocumentDraft => ({
  document_type: "",
  dependent: "",
  number: "",
  issue_date: null,
  expiry_date: null,
  issue_place: "",
  file: null,
});

export function documentForm(employee: number, draft: DocumentDraft) {
  return formData({
    employee,
    document_type: draft.document_type,
    dependent: draft.dependent || undefined,
    number: draft.number,
    issue_date: draft.issue_date ?? undefined,
    expiry_date: draft.expiry_date ?? undefined,
    issue_place: draft.issue_place,
    file: draft.file ?? undefined,
  });
}

/** The fields of one document (used by the upload dialog and the create wizard). Which fields are needed
 * follows the document type: number, expiry date. Expiry dates can be typed in Hijri (iqama). */
export function DocumentFields({
  draft,
  onChange,
  types,
  dependents = [],
  errors = {},
}: {
  draft: DocumentDraft;
  onChange: (draft: DocumentDraft) => void;
  types: DocumentType[];
  dependents?: Dependent[];
  errors?: Record<string, string>;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const set = <K extends keyof DocumentDraft>(key: K) => (value: DocumentDraft[K]) => onChange({ ...draft, [key]: value });
  const forDependent = Boolean(draft.dependent);
  const choices = types.filter((d) => d.is_active && (forDependent ? d.applies_to !== "employee" : d.applies_to !== "dependent"));
  const kind = types.find((d) => d.code === draft.document_type);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {dependents.length > 0 && (
        <FormSelect
          label={t("documents.belongsTo")}
          value={draft.dependent}
          onChange={(e) => onChange({ ...draft, dependent: e.target.value, document_type: "" })}
          options={[{ value: "", label: t("documents.theEmployee") }, ...dependents.map((d) => ({ value: String(d.id), label: format.name(d) }))]}
          error={errors.dependent}
          className="sm:col-span-2"
        />
      )}
      <FormSelect
        label={t("documents.type")}
        name="document_type"
        value={draft.document_type}
        onChange={(e) => set("document_type")(e.target.value)}
        placeholder={t("common.choose")}
        options={choices.map((d) => ({ value: d.code, label: format.name(d) }))}
        error={errors.document_type}
      />
      <TextField
        label={kind?.requires_number === false ? t("documents.numberOptional") : t("documents.number")}
        name="number"
        dir="ltr"
        value={draft.number}
        onChange={(e) => set("number")(e.target.value)}
        error={errors.number}
      />
      <DateInput label={t("documents.issueDate")} value={draft.issue_date} onChange={set("issue_date")} hijri error={errors.issue_date ?? errors.issue_date_hijri} />
      {kind?.has_expiry !== false && (
        <DateInput
          label={t("documents.expiryDate")}
          name="expiry_date"
          value={draft.expiry_date}
          onChange={set("expiry_date")}
          hijri
          error={errors.expiry_date ?? errors.expiry_date_hijri}
        />
      )}
      <TextField label={t("documents.issuePlace")} value={draft.issue_place} onChange={(e) => set("issue_place")(e.target.value)} error={errors.issue_place} />
      <FileDrop label={t("documents.file")} file={draft.file} onChange={set("file")} error={errors.file} className="sm:col-span-2" />
    </div>
  );
}

/** Upload a new document for the employee or one of their dependents. */
export function DocumentDialog({
  employee,
  types,
  dependents,
  onClose,
}: {
  employee: number;
  types: DocumentType[];
  dependents: Dependent[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(emptyDocument);
  const upload = useMutation({
    mutationFn: () => hr.uploadDocument(documentForm(employee, draft)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employee", employee] });
      onClose();
    },
  });
  const errors = apiErrors(upload.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={t("documents.upload")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!draft.document_type || upload.isPending} onClick={() => upload.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <DocumentFields draft={draft} onChange={setDraft} types={types} dependents={dependents} errors={errors.fields} />
      {errors.general && <Alert className="mt-4">{errors.general}</Alert>}
    </Dialog>
  );
}
