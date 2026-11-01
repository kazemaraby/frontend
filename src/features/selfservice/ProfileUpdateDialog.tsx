import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "@/api";
import { formData, hr } from "@/api/hr";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Dialog } from "@/design/Dialog";
import { FormSelect, TextArea, TextField } from "@/design/Field";
import { FileDrop } from "@/design/FileDrop";
import { MARITAL } from "@/features/employees/profile/fields";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

type Values = Record<string, string | number | null>;
const GROUPS: { key: string; fields: string[] }[] = [
  { key: "contact", fields: ["mobile", "personal_email", "marital_status"] },
  { key: "address", fields: ["building_number", "street", "district", "city", "postal_code", "additional_number"] },
  { key: "emergency", fields: ["emergency_contact_name", "emergency_contact_phone", "emergency_contact_relation"] },
  { key: "bank", fields: ["iban", "account_holder_name"] },
];
const LTR = new Set(["mobile", "personal_email", "building_number", "postal_code", "additional_number", "emergency_contact_phone", "iban"]);

const fieldsOf = () => api.get<{ values: Values; editable: string[]; needs_attachment: string[] }>("/profile-requests/fields");

/** Ask HR to change one's own details (apps.employees.profile_changes): only what is changed is sent; HR approves
 * and the file is updated with its own rules. A new IBAN needs the bank letter. */
type Stored = { id: number; changes: Values; reason: string; has_file: boolean };

export function ProfileUpdateDialog({ editId, onClose }: { editId?: number; onClose: () => void }) {
  const { t } = useTranslation();
  const stored = useQuery({ queryKey: ["profile-request", "edit", editId], queryFn: () => api.get<Stored>(`/profile-requests/${editId}`), enabled: Boolean(editId) });
  if (editId && !stored.data)
    return (
      <Dialog open onClose={onClose} title={t("approvals.editAndResubmit")}>
        {stored.isError ? <Alert>{apiErrors(stored.error, t("common.loadFailed")).general}</Alert> : <p className="text-muted">{t("common.loading")}</p>}
      </Dialog>
    );
  return <ProfileForm stored={stored.data} onClose={onClose} />;
}

/** With `stored`: the returned request being corrected (its changes are the starting edits; its file is kept
 * unless another is chosen). */
function ProfileForm({ stored, onClose }: { stored?: Stored; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const current = useQuery({ queryKey: ["profile-request", "fields"], queryFn: fieldsOf });
  const cities = useQuery({ queryKey: ["reference", "cities", "SA"], queryFn: () => hr.cities(), staleTime: 86_400_000 });
  const [edits, setEdits] = useState<Values>(stored?.changes ?? {});
  const [reason, setReason] = useState(stored?.reason ?? "");
  const [file, setFile] = useState<File | null>(null);
  const original = current.data?.values ?? {};
  const value = (name: string) => (name in edits ? edits[name] : original[name]) ?? "";
  const changes = Object.fromEntries(Object.entries(edits).filter(([k, v]) => String(v ?? "") !== String(original[k] ?? "")));
  const needsFile = Object.keys(changes).some((k) => current.data?.needs_attachment.includes(k));

  const save = useMutation({
    mutationFn: async () => {
      const body = formData({ changes: JSON.stringify(changes), reason, ...(file ? { file } : {}) });
      if (!stored) return api.post("/profile-requests", body);
      await api.patch(`/profile-requests/${stored.id}`, body);
      return api.post(`/profile-requests/${stored.id}/submit`, {});
    },
    onSuccess: async () => {
      await Promise.all(["requests", "approvals"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));

  const input = (name: string) => {
    const label = t(`employee.fields.${name}`);
    const set = (v: string) => setEdits((x) => ({ ...x, [name]: name === "city" ? (v ? Number(v) : null) : v }));
    if (name === "marital_status")
      return (
        <FormSelect key={name} label={label} name={name} value={String(value(name))} placeholder="—" onChange={(e) => set(e.target.value)} options={MARITAL.map((m) => ({ value: m, label: t(`employee.marital.${m}`) }))} error={errors.fields[name]} />
      );
    if (name === "city")
      return (
        <FormSelect key={name} label={label} name={name} value={String(value(name))} placeholder="—" onChange={(e) => set(e.target.value)} options={(cities.data ?? []).map((c) => ({ value: String(c.id), label: format.name(c) }))} error={errors.fields[name]} />
      );
    return <TextField key={name} label={label} name={name} dir={LTR.has(name) ? "ltr" : undefined} value={String(value(name))} onChange={(e) => set(e.target.value)} error={errors.fields[name]} />;
  };

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={stored ? `${t("approvals.editAndResubmit")} · ${t("profileUpdate.title")}` : t("profileUpdate.title")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="accent" disabled={!Object.keys(changes).length || (needsFile && !file && !stored?.has_file) || save.isPending} onClick={() => save.mutate()}>
            {t("approvals.sendForApproval")}
          </Button>
        </>
      }
    >
      {current.isPending ? (
        <p className="text-muted">{t("common.loading")}</p>
      ) : current.isError ? (
        <Alert>{apiErrors(current.error, t("common.loadFailed")).general}</Alert>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted">{t("profileUpdate.hint")}</p>
          {GROUPS.map((group) => (
            <fieldset key={group.key} className="flex flex-col gap-3">
              <legend className="mb-1 font-semibold text-ink">{t(`profileUpdate.groups.${group.key}`)}</legend>
              <div className="grid gap-4 sm:grid-cols-2">{group.fields.map(input)}</div>
            </fieldset>
          ))}
          {needsFile && <FileDrop label={t("profileUpdate.bankLetter")} file={file} onChange={setFile} current={stored?.has_file ? t("profileUpdate.fileKept") : undefined} error={errors.fields.file} />}
          <TextArea label={t("leave.reason")} name="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          {Object.keys(changes).length > 0 && <p role="status" className="text-sm text-teal-ink">{t("profileUpdate.changed", { count: Object.keys(changes).length })}</p>}
          {(errors.general || errors.fields.changes || errors.fields.detail) && <Alert>{errors.general ?? errors.fields.changes ?? errors.fields.detail}</Alert>}
        </div>
      )}
    </Dialog>
  );
}
