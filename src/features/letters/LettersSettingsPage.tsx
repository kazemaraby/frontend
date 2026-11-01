import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Download, Eye, FilePlus2, Pencil, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { hr } from "@/api/hr";
import { type Letter, type LetterKind, type LetterLanguage, letters, type LetterTemplate, type Signatory } from "@/api/letters";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextArea, TextField } from "@/design/Field";
import { FileDrop } from "@/design/FileDrop";
import { Pagination } from "@/design/Pagination";
import { Pill } from "@/design/Pill";
import { openFile } from "@/features/employees/download";
import NoAccess from "@/features/misc/NoAccessPage";
import { Page } from "@/layout/Page";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { LANGUAGES } from "./LetterRequestDialog";
import { letterTitle, LetterStatus } from "./MyLettersCard";

const KINDS: LetterKind[] = ["salary_certificate", "employment", "experience", "no_objection", "bank", "embassy", "other"];
const IMAGES = "image/png,image/jpeg";
const PAGE_SIZE = 25;

/** /settings/letters — letter templates (with {{ placeholders }}), who signs them (signature and stamp images in
 * private storage, decision 10) and the letters issued: download, revoke, or issue one directly. */
export default function LettersSettingsPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  if (!can("selfservice.manage_letters")) return <NoAccess />;
  return (
    <Page title={t("letters.title")}>
      <div className="flex flex-col gap-4">
        <IssuedCard />
        <TemplatesCard />
        <SignatoriesCard />
      </div>
    </Page>
  );
}

// --- issued letters -------------------------------------------------------------------------

function IssuedCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const [page, setPage] = useState(1);
  const [issuing, setIssuing] = useState(false);
  const [revoking, setRevoking] = useState<Letter | null>(null);
  const issued = useQuery({ queryKey: ["letters", "issued", page, ...scope], queryFn: () => letters.list({ page }), placeholderData: (previous) => previous });
  const columns: Column<Letter>[] = [
    {
      id: "employee",
      header: t("letters.employee"),
      cell: (l) => (
        <span className="flex flex-col">
          <span className="font-semibold text-ink">{format.name(l.employee)}</span>
          <span className="num text-sm text-muted">{l.employee.employee_no}</span>
        </span>
      ),
    },
    {
      id: "letter",
      header: t("letters.letter"),
      cell: (l) => (
        <span className="flex flex-col">
          <span>{letterTitle(format, l)}</span>
          <span className="num text-sm text-muted" dir="ltr">{l.reference}</span>
        </span>
      ),
    },
    { id: "issued", header: t("letters.issuedOn"), cell: (l) => <span className="num text-muted">{format.date(l.issued_on)}</span> },
    {
      id: "status",
      header: t("approvals.columns.status"),
      cell: (l) => (
        <span className="flex flex-col items-start gap-1">
          <LetterStatus letter={l} />
          {l.revoke_reason && <span className="text-sm text-muted">{l.revoke_reason}</span>}
        </span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      cell: (l) => (
        <span className="flex justify-end gap-1">
          <IconButton size="sm" variant="plain" label={t("letters.download", { reference: l.reference })} icon={<Download />} onClick={() => void openFile(() => letters.link(l.id))} />
          {l.status === "valid" && <IconButton size="sm" variant="plain" label={t("letters.revoke", { reference: l.reference })} icon={<Ban />} onClick={() => setRevoking(l)} />}
        </span>
      ),
    },
  ];
  const total = issued.data?.count ?? 0;
  return (
    <Card
      variant="solid"
      title={t("letters.issued")}
      action={
        <Button size="sm" variant="accent" icon={<FilePlus2 className="size-4" />} onClick={() => setIssuing(true)}>
          {t("letters.issue")}
        </Button>
      }
    >
      <DataTable caption={t("letters.issued")} columns={columns} rows={issued.data?.results ?? []} rowKey={(l) => String(l.id)} loading={issued.isPending} empty={t("letters.none")} minWidth={720} />
      {total > PAGE_SIZE && <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} onPageChange={setPage} />}
      {issuing && <IssueDialog onClose={() => setIssuing(false)} />}
      {revoking && <RevokeDialog letter={revoking} onClose={() => setRevoking(null)} />}
    </Card>
  );
}

function IssueDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [v, setV] = useState({ employee: "", template: "", language: "ar" as LetterLanguage, addressee: "", purpose: "" });
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) => setV((x) => ({ ...x, [key]: value }));
  const employees = useQuery({ queryKey: ["letters", "employees", search, ...scope], queryFn: () => hr.searchEmployees(search), placeholderData: (previous) => previous });
  const templates = useQuery({ queryKey: ["letters", "templates", "active", ...scope], queryFn: () => letters.templates(true) });
  const save = useMutation({
    mutationFn: () => letters.issue({ ...v, employee: Number(v.employee), template: Number(v.template) }),
    onSuccess: async (letter) => {
      await queryClient.invalidateQueries({ queryKey: ["letters"] });
      onClose();
      void openFile(() => letters.link(letter.id));
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("letters.issue")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!v.employee || !v.template || save.isPending} onClick={() => save.mutate()}>
            {t("letters.issueNow")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("letters.issueHint")}</p>
        <TextField label={t("workflow.preview.findEmployee")} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <FormSelect
          label={t("letters.employee")}
          name="employee"
          value={v.employee}
          placeholder={t("common.choose")}
          options={(employees.data?.results ?? []).map((e) => ({ value: String(e.id), label: `${format.name(e)} · ${e.employee_no}` }))}
          onChange={(e) => set("employee", e.target.value)}
          error={errors.fields.employee}
        />
        <FormSelect
          label={t("letters.letter")}
          name="template"
          value={v.template}
          placeholder={t("common.choose")}
          options={(templates.data ?? []).map((x) => ({ value: String(x.id), label: format.pick({ ar: x.name_ar, en: x.name_en || x.name_ar }) }))}
          onChange={(e) => set("template", e.target.value)}
          error={errors.fields.template}
        />
        <FormSelect label={t("letters.language")} name="language" value={v.language} onChange={(e) => set("language", e.target.value as LetterLanguage)} options={LANGUAGES.map((l) => ({ value: l, label: t(`letters.languages.${l}`) }))} />
        <TextField label={t("letters.addressee")} name="addressee" value={v.addressee} onChange={(e) => set("addressee", e.target.value)} hint={t("letters.addresseeHint")} />
        <TextField label={t("letters.purposeOptional")} name="purpose" value={v.purpose} onChange={(e) => set("purpose", e.target.value)} />
        {(errors.general || errors.fields.detail) && <Alert>{errors.general ?? errors.fields.detail}</Alert>}
      </div>
    </Dialog>
  );
}

function RevokeDialog({ letter, onClose }: { letter: Letter; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const save = useMutation({
    mutationFn: () => letters.revoke(letter.id, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["letters"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("letters.revoke", { reference: letter.reference })}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!reason.trim() || save.isPending} onClick={() => save.mutate()}>
            {t("letters.revokeNow")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("letters.revokeHint")}</p>
        <TextArea label={t("letters.revokeReason")} name="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} error={errors.fields.reason} required />
        {(errors.general || errors.fields.detail) && <Alert>{errors.general ?? errors.fields.detail}</Alert>}
      </div>
    </Dialog>
  );
}

// --- templates ------------------------------------------------------------------------------

function TemplatesCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const templates = useQuery({ queryKey: ["letters", "templates", "all", ...scope], queryFn: () => letters.templates() });
  const [editing, setEditing] = useState<LetterTemplate | "new" | null>(null);
  return (
    <Card
      variant="solid"
      title={t("letters.templates")}
      subtitle={t("letters.templatesHint")}
      action={
        <Button size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
          {t("letters.addTemplate")}
        </Button>
      }
    >
      <ul aria-label={t("letters.templates")} className="flex flex-col divide-y divide-line">
        {(templates.data ?? []).map((x) => {
          const name = format.pick({ ar: x.name_ar, en: x.name_en || x.name_ar });
          return (
            <li key={x.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-48 font-medium">{name}</span>
              <Pill tone="sky">{t(`letters.kinds.${x.kind}`)}</Pill>
              <Pill tone={x.scope === "tenant" ? "lavender" : "teal"}>{t(`letters.scopes.${x.scope}`)}</Pill>
              {x.shows_salary && <Pill tone="amber">{t("letters.salary")}</Pill>}
              {!x.is_active && <Pill tone="navy">{t("leaveSettings.off")}</Pill>}
              <IconButton className="ms-auto" size="sm" variant="plain" label={t("common.editNamed", { name })} icon={<Pencil />} onClick={() => setEditing(x)} />
            </li>
          );
        })}
      </ul>
      {editing && <TemplateDialog template={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function TemplateDialog({ template, onClose }: { template?: LetterTemplate; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const placeholders = useQuery({ queryKey: ["letters", "placeholders"], queryFn: letters.placeholders, staleTime: Infinity });
  const [v, setV] = useState({
    scope: template?.scope ?? ("company" as LetterTemplate["scope"]),
    code: template?.code ?? "",
    kind: template?.kind ?? ("other" as LetterKind),
    name_ar: template?.name_ar ?? "",
    name_en: template?.name_en ?? "",
    body_ar: template?.body_ar ?? "",
    body_en: template?.body_en ?? "",
    shows_salary: template?.shows_salary ?? false,
    is_active: template?.is_active ?? true,
  });
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) => setV((x) => ({ ...x, [key]: value }));
  // The placeholder buttons insert at the cursor of the body that was last in focus.
  const focused = useRef<{ field: "body_ar" | "body_en"; element: HTMLTextAreaElement } | null>(null);
  const insert = (name: string) => {
    const target = focused.current ?? { field: "body_ar" as const, element: null };
    const text = v[target.field];
    const at = target.element?.selectionStart ?? text.length;
    const token = `{{ ${name} }}`;
    set(target.field, text.slice(0, at) + token + text.slice(target.element?.selectionEnd ?? at));
    requestAnimationFrame(() => {
      target.element?.focus();
      target.element?.setSelectionRange(at + token.length, at + token.length);
    });
  };
  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ["letters"] });
    onClose();
  };
  const save = useMutation({
    mutationFn: () => {
      const { scope, code, ...rest } = v;
      return letters.saveTemplate(template ? (template.is_system ? rest : { ...rest, code }) : { ...rest, code, scope }, template?.id);
    },
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: () => letters.deleteTemplate(template!.id), onSuccess: done });
  const errors = apiErrors(save.error ?? remove.error, t("common.saveFailed"));
  const salary = new Set(placeholders.data?.salary ?? []);
  const body = (field: "body_ar" | "body_en", label: string, dir: "rtl" | "ltr") => (
    <TextArea
      label={label}
      name={field}
      rows={8}
      dir={dir}
      value={v[field]}
      onChange={(e) => set(field, e.target.value)}
      onFocus={(e) => (focused.current = { field, element: e.currentTarget })}
      error={errors.fields[field]}
      required={field === "body_ar"}
    />
  );
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={template ? t("letters.editTemplate") : t("letters.addTemplate")}
      footer={
        <>
          {template && !template.is_system && (
            <Button variant="outline" className="me-auto" disabled={remove.isPending} onClick={() => remove.mutate()}>
              {t("common.delete")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!v.name_ar.trim() || !v.body_ar.trim() || (!template && !v.code.trim()) || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("letters.nameAr")} name="name_ar" value={v.name_ar} onChange={(e) => set("name_ar", e.target.value)} error={errors.fields.name_ar} required />
          <TextField label={t("letters.nameEn")} name="name_en" dir="ltr" value={v.name_en} onChange={(e) => set("name_en", e.target.value)} error={errors.fields.name_en} />
          <FormSelect label={t("letters.kind")} name="kind" value={v.kind} onChange={(e) => set("kind", e.target.value as LetterKind)} options={KINDS.map((k) => ({ value: k, label: t(`letters.kinds.${k}`) }))} />
          <TextField label={t("letters.code")} name="code" dir="ltr" value={v.code} disabled={Boolean(template?.is_system)} onChange={(e) => set("code", e.target.value)} error={errors.fields.code} required={!template} />
          {!template && (
            <FormSelect label={t("letters.scope")} name="scope" value={v.scope} onChange={(e) => set("scope", e.target.value as LetterTemplate["scope"])} options={(["company", "tenant"] as const).map((s) => ({ value: s, label: t(`letters.scopes.${s}`) }))} />
          )}
          <div className="flex flex-col gap-2 self-end pb-2">
            <CheckField label={t("letters.salaryField")} checked={v.shows_salary} onChange={(e) => set("shows_salary", e.target.checked)} />
            <CheckField label={t("leaveSettings.active")} checked={v.is_active} onChange={(e) => set("is_active", e.target.checked)} />
          </div>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">{t("letters.placeholders")}</legend>
          <p className="mb-2 text-sm text-muted">{t("letters.placeholdersHint")}</p>
          <div className="flex flex-wrap gap-2">
            {(placeholders.data?.placeholders ?? []).map((name) => (
              <button
                key={name}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert(name)}
                disabled={salary.has(name) && !v.shows_salary}
                className="rounded-full border border-line bg-white px-3 py-1 text-[13px] text-ink hover:border-teal-dark disabled:opacity-40"
              >
                {t(`letters.fields.${name}`, { defaultValue: name })}
              </button>
            ))}
          </div>
        </fieldset>
        {body("body_ar", t("letters.bodyAr"), "rtl")}
        {body("body_en", t("letters.bodyEn"), "ltr")}
        {(errors.general || errors.fields.detail) && <Alert>{errors.general ?? errors.fields.detail}</Alert>}
      </div>
    </Dialog>
  );
}

// --- signatories ----------------------------------------------------------------------------

function SignatoriesCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const signatories = useQuery({ queryKey: ["letters", "signatories", ...scope], queryFn: letters.signatories });
  const [editing, setEditing] = useState<Signatory | "new" | null>(null);
  const rows = signatories.data ?? [];
  return (
    <Card
      variant="solid"
      title={t("letters.signatories")}
      subtitle={t("letters.signatoriesHint")}
      action={
        <Button size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
          {t("letters.addSignatory")}
        </Button>
      }
    >
      {signatories.isSuccess && rows.length === 0 ? (
        <Alert tone="warning">{t("letters.noSignatory")}</Alert>
      ) : (
        <ul aria-label={t("letters.signatories")} className="flex flex-col divide-y divide-line">
          {rows.map((s) => {
            const name = format.name(s);
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex min-w-48 flex-col">
                  <span className="font-medium">{name}</span>
                  <span className="text-sm text-muted">{format.pick({ ar: s.title_ar, en: s.title_en || s.title_ar })}</span>
                </span>
                {s.is_default && <Pill tone="teal">{t("letters.default")}</Pill>}
                {!s.has_signature && <Pill tone="amber">{t("letters.noSignature")}</Pill>}
                {!s.is_active && <Pill tone="navy">{t("leaveSettings.off")}</Pill>}
                <IconButton className="ms-auto" size="sm" variant="plain" label={t("common.editNamed", { name })} icon={<Pencil />} onClick={() => setEditing(s)} />
              </li>
            );
          })}
        </ul>
      )}
      {editing && <SignatoryDialog signatory={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function SignatoryDialog({ signatory, onClose }: { signatory?: Signatory; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [v, setV] = useState({
    name_ar: signatory?.name_ar ?? "",
    name_en: signatory?.name_en ?? "",
    title_ar: signatory?.title_ar ?? "",
    title_en: signatory?.title_en ?? "",
    is_default: signatory?.is_default ?? false,
    is_active: signatory?.is_active ?? true,
  });
  const [signature, setSignature] = useState<File | null>(null);
  const [stamp, setStamp] = useState<File | null>(null);
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) => setV((x) => ({ ...x, [key]: value }));
  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ["letters", "signatories"] });
    onClose();
  };
  const save = useMutation({
    mutationFn: () => letters.saveSignatory({ ...v, ...(signature ? { signature } : {}), ...(stamp ? { stamp } : {}) }, signatory?.id),
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: () => letters.deleteSignatory(signatory!.id), onSuccess: done });
  const errors = apiErrors(save.error ?? remove.error, t("common.saveFailed"));
  const view = (field: "signature" | "stamp") =>
    signatory?.[field === "signature" ? "has_signature" : "has_stamp"] && (
      <Button size="sm" variant="ghost" icon={<Eye className="size-4" />} iconPosition="start" onClick={() => void openFile(() => letters.signatoryImage(signatory.id, field))}>
        {t(`letters.view.${field}`)}
      </Button>
    );
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={signatory ? t("letters.editSignatory") : t("letters.addSignatory")}
      footer={
        <>
          {signatory && (
            <Button variant="outline" className="me-auto" disabled={remove.isPending} onClick={() => remove.mutate()}>
              {t("common.delete")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!v.name_ar.trim() || !v.title_ar.trim() || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t("letters.nameAr")} name="name_ar" value={v.name_ar} onChange={(e) => set("name_ar", e.target.value)} error={errors.fields.name_ar} required />
        <TextField label={t("letters.nameEn")} name="name_en" dir="ltr" value={v.name_en} onChange={(e) => set("name_en", e.target.value)} />
        <TextField label={t("letters.titleAr")} name="title_ar" value={v.title_ar} onChange={(e) => set("title_ar", e.target.value)} error={errors.fields.title_ar} required />
        <TextField label={t("letters.titleEn")} name="title_en" dir="ltr" value={v.title_en} onChange={(e) => set("title_en", e.target.value)} />
        <div className="flex flex-col gap-2">
          <FileDrop label={t("letters.signature")} file={signature} onChange={setSignature} accept={IMAGES} limits={t("letters.imageLimits")} error={errors.fields.signature} />
          {view("signature")}
        </div>
        <div className="flex flex-col gap-2">
          <FileDrop label={t("letters.stamp")} file={stamp} onChange={setStamp} accept={IMAGES} limits={t("letters.imageLimits")} error={errors.fields.stamp} />
          {view("stamp")}
        </div>
        <CheckField label={t("letters.makeDefault")} checked={v.is_default} onChange={(e) => set("is_default", e.target.checked)} />
        <CheckField label={t("leaveSettings.active")} checked={v.is_active} onChange={(e) => set("is_active", e.target.checked)} />
        {(errors.general || errors.fields.detail) && <Alert className="sm:col-span-2">{errors.general ?? errors.fields.detail}</Alert>}
      </div>
    </Dialog>
  );
}
