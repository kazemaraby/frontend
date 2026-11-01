import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { candidateDataApi, type Criterion, type InterviewTemplate, interviewsApi, type Opening, type OpeningBody, type OpeningStatus, openings, type Question, type QuestionKind, recruitment } from "@/api/recruitment";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextArea, TextField } from "@/design/Field";
import { Pill, type PillTone } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const STATUS_TONES: Record<OpeningStatus, PillTone> = { draft: "amber", published: "green", closed: "neutral" };
const KINDS: QuestionKind[] = ["text", "yes_no", "number", "choice"];

/** Job openings (#115): made from an approved requisition, published on the careers page between their dates and
 * closed. Recruiters (recruitment.manage) change them; a hiring manager sees their own. */
export function OpeningsCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const manage = can("recruitment.manage");
  const [editing, setEditing] = useState<Opening | "new" | null>(null);
  const list = useQuery({ queryKey: ["openings", ...scope], queryFn: () => openings.list({}) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["openings"] });
  const act = useMutation({
    mutationFn: async ({ id, what }: { id: number; what: "publish" | "close" | "remove" }) => {
      if (what === "remove") await openings.remove(id);
      else await openings[what](id);
    },
    onSuccess: refresh,
  });
  const link = (o: Opening) => `${window.location.origin}/careers/${o.public_id}`;
  const columns: Column<Opening>[] = [
    {
      id: "title",
      header: t("recruitment.openings.title"),
      cell: (o) => (
        <span className="flex flex-col">
          <span className="font-semibold text-ink">{format.lang === "en" ? o.title_en || o.title_ar : o.title_ar}</span>
          <span className="text-sm text-muted">{format.name(o.names.department)}</span>
        </span>
      ),
    },
    { id: "status", header: t("recruitment.requisition.status"), cell: (o) => <Pill tone={STATUS_TONES[o.status]}>{t(`recruitment.openings.statuses.${o.status}`)}</Pill> },
    {
      id: "dates",
      header: t("recruitment.openings.dates"),
      cell: (o) => <span className="num text-sm">{o.publish_on ? `${format.date(o.publish_on)} – ${o.close_on ? format.date(o.close_on) : t("recruitment.openings.noEnd")}` : "—"}</span>,
    },
    { id: "positions", header: t("recruitment.openings.openPositions"), cell: (o) => <span className="num">{format.number(o.names.open_positions)}</span> },
    { id: "applications", header: t("recruitment.openings.applications"), cell: (o) => <span className="num font-semibold">{format.number(o.counts.total)}</span> },
    {
      id: "actions",
      header: t("common.actions"),
      cell: (o) => (
        <span className="flex flex-wrap items-center gap-2">
          {o.status === "published" && (
            <a href={link(o)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-teal-dark hover:underline">
              {t("recruitment.openings.careersLink")} <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          )}
          {manage && o.status !== "published" && (
            <Button size="sm" variant="outline" onClick={() => act.mutate({ id: o.id, what: "publish" })}>
              {t("recruitment.openings.publish")}
            </Button>
          )}
          {manage && o.status === "published" && (
            <Button size="sm" variant="outline" onClick={() => act.mutate({ id: o.id, what: "close" })}>
              {t("recruitment.openings.close")}
            </Button>
          )}
        </span>
      ),
    },
  ];
  return (
    <Card
      title={t("recruitment.openings.cardTitle")}
      action={
        manage && (
          <Button variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
            {t("recruitment.openings.add")}
          </Button>
        )
      }
    >
      <DataTable
        caption={t("recruitment.openings.cardTitle")}
        columns={columns}
        rows={list.data?.results ?? []}
        rowKey={(o) => String(o.id)}
        rowLabel={(o) => o.title_ar}
        loading={list.isPending}
        empty={t("recruitment.openings.empty")}
        onEdit={manage ? (o) => setEditing(o) : undefined}
        onDelete={manage ? (o) => act.mutate({ id: o.id, what: "remove" }) : undefined}
      />
      {act.isError && <Alert className="mt-3">{apiErrors(act.error, t("common.saveFailed")).general ?? apiErrors(act.error, "").fields.detail}</Alert>}
      {editing !== null && <OpeningDialog row={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

const EMPTY: OpeningBody = { requisition: null, title_ar: "", title_en: "", description_ar: "", description_en: "", requirements_ar: "", requirements_en: "", questions: [], publish_on: null, close_on: null, talent_pool: true };

function OpeningDialog({ row, onClose }: { row: Opening | null; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [v, setV] = useState<OpeningBody>(row ? { ...row } : EMPTY);
  const approved = useQuery({ queryKey: ["requisitions", "approved"], queryFn: () => recruitment.requisitions({ status: "approved" }), enabled: !row });
  const choices = (approved.data?.results ?? []).filter((r) => !r.closed_at && r.filled < r.positions);
  const save = useMutation({
    mutationFn: () => (row ? openings.update(row.id, v) : openings.create({ ...v, requisition: v.requisition! })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["openings"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const setQuestion = (index: number, patch: Partial<Question>) => setV({ ...v, questions: v.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)) });
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={row ? t("recruitment.openings.edit") : t("recruitment.openings.add")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="accent" disabled={save.isPending || (!row && !v.requisition)} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!row && (
          <FormSelect
            label={t("recruitment.openings.requisition")}
            name="requisition"
            placeholder={t("common.choose")}
            value={v.requisition ?? ""}
            onChange={(e) => setV({ ...v, requisition: e.target.value ? Number(e.target.value) : null })}
            options={choices.map((r) => ({ value: String(r.id), label: `${format.name(r.names.job_title)} · ${format.name(r.names.department)} (${format.number(r.positions - r.filled)})` }))}
            hint={approved.isSuccess && choices.length === 0 ? t("recruitment.openings.noRequisitions") : undefined}
            error={errors.fields.requisition}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("recruitment.openings.titleAr")} name="title_ar" hint={!row ? t("recruitment.openings.titleHint") : undefined} value={v.title_ar} onChange={(e) => setV({ ...v, title_ar: e.target.value })} error={errors.fields.title_ar} />
          <TextField label={t("recruitment.openings.titleEn")} name="title_en" dir="ltr" value={v.title_en} onChange={(e) => setV({ ...v, title_en: e.target.value })} />
        </div>
        <TextArea label={t("recruitment.openings.descriptionAr")} name="description_ar" rows={4} value={v.description_ar} onChange={(e) => setV({ ...v, description_ar: e.target.value })} error={errors.fields.description_ar} />
        <TextArea label={t("recruitment.openings.descriptionEn")} name="description_en" rows={3} dir="ltr" value={v.description_en} onChange={(e) => setV({ ...v, description_en: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextArea label={t("recruitment.openings.requirementsAr")} name="requirements_ar" rows={3} value={v.requirements_ar} onChange={(e) => setV({ ...v, requirements_ar: e.target.value })} />
          <TextArea label={t("recruitment.openings.requirementsEn")} name="requirements_en" rows={3} dir="ltr" value={v.requirements_en} onChange={(e) => setV({ ...v, requirements_en: e.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <DateInput label={t("recruitment.openings.publishOn")} name="publish_on" value={v.publish_on} onChange={(d) => setV({ ...v, publish_on: d })} error={errors.fields.publish_on} />
          <DateInput label={t("recruitment.openings.closeOn")} name="close_on" value={v.close_on} onChange={(d) => setV({ ...v, close_on: d })} error={errors.fields.close_on} />
        </div>
        <CheckField label={t("recruitment.openings.talentPool")} checked={v.talent_pool} onChange={(e) => setV({ ...v, talent_pool: e.target.checked })} />
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium text-ink">{t("recruitment.openings.questions")}</legend>
          {v.questions.map((q, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-card bg-neutral-soft p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <TextField label={t("recruitment.openings.questionAr")} name={`question_${i}_ar`} value={q.text_ar} onChange={(e) => setQuestion(i, { text_ar: e.target.value })} />
                <TextField label={t("recruitment.openings.questionEn")} name={`question_${i}_en`} dir="ltr" value={q.text_en} onChange={(e) => setQuestion(i, { text_en: e.target.value })} />
                <IconButton label={t("common.delete")} variant="danger" className="self-end" icon={<Trash2 className="size-4" />} onClick={() => setV({ ...v, questions: v.questions.filter((_, j) => j !== i) })} />
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <FormSelect label={t("recruitment.openings.kind")} name={`question_${i}_kind`} className="w-48" value={q.kind} onChange={(e) => setQuestion(i, { kind: e.target.value as QuestionKind })} options={KINDS.map((k) => ({ value: k, label: t(`recruitment.openings.kinds.${k}`) }))} />
                <CheckField label={t("recruitment.openings.required")} checked={q.required} onChange={(e) => setQuestion(i, { required: e.target.checked })} />
              </div>
              {q.kind === "choice" && (
                <TextArea
                  label={t("recruitment.openings.choices")}
                  hint={t("recruitment.openings.choicesHint")}
                  name={`question_${i}_choices`}
                  rows={3}
                  value={q.choices.map((c) => (c.en ? `${c.ar} | ${c.en}` : c.ar)).join("\n")}
                  onChange={(e) => setQuestion(i, { choices: e.target.value.split("\n").map((line) => ({ ar: line.split("|")[0]?.trim() ?? "", en: line.split("|")[1]?.trim() ?? "" })) })}
                />
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" className="self-start" icon={<Plus className="size-4" />} onClick={() => setV({ ...v, questions: [...v.questions, { text_ar: "", text_en: "", kind: "text", required: false, choices: [] }] })}>
            {t("recruitment.openings.addQuestion")}
          </Button>
          {errors.fields.questions && <p className="text-sm text-danger">{errors.fields.questions}</p>}
        </fieldset>
        {(errors.general || errors.fields.detail) && <Alert>{errors.general ?? errors.fields.detail}</Alert>}
      </div>
    </Dialog>
  );
}

/** The privacy notice candidates agree to (PDPL): versioned; a change makes a new version, never edits one agreed to. */
export function PrivacyNoticeCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const notice = useQuery({ queryKey: ["privacy-notice", ...scope], queryFn: openings.notice });
  const [draft, setDraft] = useState<{ text_ar: string; text_en: string } | null>(null);
  const save = useMutation({
    mutationFn: () => openings.newNotice(draft!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["privacy-notice"] });
      setDraft(null);
    },
  });
  const n = notice.data;
  return (
    <Card
      title={t("recruitment.notice.title")}
      subtitle={n ? t("recruitment.notice.version", { version: format.number(n.version), consents: format.number(n.consents) }) : undefined}
      action={
        can("recruitment.manage") &&
        n &&
        !draft && (
          <Button variant="outline" onClick={() => setDraft({ text_ar: n.text_ar, text_en: n.text_en })}>
            {t("recruitment.notice.newVersion")}
          </Button>
        )
      }
    >
      {draft ? (
        <div className="flex flex-col gap-4">
          <TextArea label={t("recruitment.notice.textAr")} name="text_ar" rows={6} value={draft.text_ar} onChange={(e) => setDraft({ ...draft, text_ar: e.target.value })} error={apiErrors(save.error, "").fields.text_ar} />
          <TextArea label={t("recruitment.notice.textEn")} name="text_en" rows={6} dir="ltr" value={draft.text_en} onChange={(e) => setDraft({ ...draft, text_en: e.target.value })} />
          <p className="text-sm text-muted">{t("recruitment.notice.newVersionHint")}</p>
          <div className="flex gap-2">
            <Button variant="accent" disabled={save.isPending} onClick={() => save.mutate()}>
              {t("common.save")}
            </Button>
            <Button variant="outline" onClick={() => setDraft(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        n && <p className="whitespace-pre-line leading-7 text-ink">{format.lang === "en" ? n.text_en || n.text_ar : n.text_ar}</p>
      )}
    </Card>
  );
}

/** Scorecard templates (#117): bilingual criteria on a 1–N scale, chosen when an interview is scheduled. */
export function InterviewTemplatesCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const manage = can("recruitment.manage");
  const list = useQuery({ queryKey: ["interview-templates"], queryFn: interviewsApi.templates });
  const [editing, setEditing] = useState<InterviewTemplate | "new" | null>(null);
  const remove = useMutation({ mutationFn: (id: number) => interviewsApi.deleteTemplate(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["interview-templates"] }) });
  const columns: Column<InterviewTemplate>[] = [
    { id: "name", header: t("recruitment.templates.name"), cell: (x) => <span className="font-semibold text-ink">{format.name(x)}</span> },
    { id: "criteria", header: t("recruitment.templates.criteria"), cell: (x) => x.criteria.map((c) => (format.lang === "en" ? c.text_en || c.text_ar : c.text_ar)).join(t("common.listSeparator")) },
    { id: "scale", header: t("recruitment.templates.scale"), cell: (x) => <span className="num">1–{format.number(x.scale_max)}</span> },
  ];
  return (
    <Card
      title={t("recruitment.templates.title")}
      action={
        manage && (
          <Button variant="outline" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
            {t("recruitment.templates.add")}
          </Button>
        )
      }
    >
      <DataTable caption={t("recruitment.templates.title")} columns={columns} rows={list.data?.results ?? []} rowKey={(x) => String(x.id)} rowLabel={(x) => x.name_ar} minWidth={640} loading={list.isPending} empty={t("recruitment.templates.empty")} onEdit={manage ? (x) => setEditing(x) : undefined} onDelete={manage ? (x) => remove.mutate(x.id) : undefined} />
      {remove.isError && <Alert className="mt-3">{apiErrors(remove.error, t("common.saveFailed")).general}</Alert>}
      {editing !== null && <TemplateDialog row={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function TemplateDialog({ row, onClose }: { row: InterviewTemplate | null; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [v, setV] = useState<Omit<InterviewTemplate, "id">>(row ?? { name_ar: "", name_en: "", criteria: [{ text_ar: "", text_en: "" }], scale_max: 5, is_active: true });
  const save = useMutation({
    mutationFn: () => interviewsApi.saveTemplate({ ...v, id: row?.id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["interview-templates"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const setCriterion = (i: number, patch: Partial<Criterion>) => setV({ ...v, criteria: v.criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <Dialog
      open
      onClose={onClose}
      title={row ? t("recruitment.templates.edit") : t("recruitment.templates.add")}
      footer={
        <Button variant="accent" disabled={save.isPending || !v.name_ar.trim()} onClick={() => save.mutate()}>
          {t("common.save")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("recruitment.templates.nameAr")} name="name_ar" value={v.name_ar} onChange={(e) => setV({ ...v, name_ar: e.target.value })} error={errors.fields.name_ar} />
          <TextField label={t("recruitment.templates.nameEn")} name="name_en" dir="ltr" value={v.name_en} onChange={(e) => setV({ ...v, name_en: e.target.value })} />
        </div>
        <TextField label={t("recruitment.templates.scaleMax")} name="scale_max" type="number" min={3} max={10} dir="ltr" value={String(v.scale_max)} onChange={(e) => setV({ ...v, scale_max: Number(e.target.value) || 5 })} error={errors.fields.scale_max} />
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium text-ink">{t("recruitment.templates.criteria")}</legend>
          {v.criteria.map((c, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <TextField label={t("recruitment.templates.criterionAr")} name={`criterion_${i}_ar`} value={c.text_ar} onChange={(e) => setCriterion(i, { text_ar: e.target.value })} />
              <TextField label={t("recruitment.templates.criterionEn")} name={`criterion_${i}_en`} dir="ltr" value={c.text_en} onChange={(e) => setCriterion(i, { text_en: e.target.value })} />
              <IconButton label={t("common.delete")} variant="danger" className="self-end" icon={<Trash2 className="size-4" />} onClick={() => setV({ ...v, criteria: v.criteria.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <Button variant="outline" size="sm" className="self-start" icon={<Plus className="size-4" />} onClick={() => setV({ ...v, criteria: [...v.criteria, { text_ar: "", text_en: "" }] })}>
            {t("recruitment.templates.addCriterion")}
          </Button>
          {errors.fields.criteria && <p className="text-sm text-danger">{errors.fields.criteria}</p>}
        </fieldset>
        <CheckField label={t("recruitment.templates.active")} checked={v.is_active} onChange={(e) => setV({ ...v, is_active: e.target.checked })} />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

/** How long candidates' data is kept (PDPL), for the active company (empty = the account's value). */
export function RetentionCard() {
  const { t } = useTranslation();
  const { can } = useSession();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const current = useQuery({ queryKey: ["recruitment-settings", ...scope], queryFn: candidateDataApi.settings });
  const [draft, setDraft] = useState<{ months: string; days: string } | null>(null);
  const save = useMutation({
    mutationFn: () => candidateDataApi.saveSettings({ candidate_retention_months: Number(draft!.months), renewal_notice_days: Number(draft!.days) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["recruitment-settings"] });
      setDraft(null);
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const v = current.data;
  return (
    <Card
      title={t("recruitment.retention.title")}
      subtitle={t("recruitment.retention.subtitle")}
      action={can("recruitment.manage") && v && !draft && <Button variant="outline" onClick={() => setDraft({ months: String(v.candidate_retention_months), days: String(v.renewal_notice_days) })}>{t("common.edit")}</Button>}
    >
      {draft ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={t("recruitment.retention.months")} name="candidate_retention_months" type="number" min={1} max={120} dir="ltr" value={draft.months} onChange={(e) => setDraft({ ...draft, months: e.target.value })} error={errors.fields.candidate_retention_months} />
            <TextField label={t("recruitment.retention.days")} name="renewal_notice_days" type="number" min={1} max={180} dir="ltr" value={draft.days} onChange={(e) => setDraft({ ...draft, days: e.target.value })} error={errors.fields.renewal_notice_days} />
          </div>
          <div className="flex gap-2">
            <Button variant="accent" disabled={save.isPending} onClick={() => save.mutate()}>
              {t("common.save")}
            </Button>
            <Button variant="outline" onClick={() => setDraft(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        v && <p className="num">{t("recruitment.retention.summary", { months: v.candidate_retention_months, days: v.renewal_notice_days })}</p>
      )}
    </Card>
  );
}
