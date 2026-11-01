import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { hr } from "@/api/hr";
import { endpoints } from "@/api/index";
import { type AppraisalTemplate, type Competency, type CompetencyCategory, type Cycle, CYCLE_DATES, type CycleBody, type CycleKind, type CycleStatus, performance, type RatingScale } from "@/api/performance";
import { useScopeKey } from "@/auth/session";
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

const STATUS_TONES: Record<CycleStatus, PillTone> = { draft: "amber", active: "green", closed: "neutral" };
const CATEGORIES: CompetencyCategory[] = ["core", "leadership", "technical"];

function useSaved(key: string, onClose: () => void) {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: [key] });
    onClose();
  };
}

function Footer({ disabled, onSave }: { disabled: boolean; onSave: () => void }) {
  const { t } = useTranslation();
  return (
    <Button variant="accent" disabled={disabled} onClick={onSave}>
      {t("common.save")}
    </Button>
  );
}

// --- cycles -----------------------------------------------------------------------------------------------------

export function CyclesCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Cycle | "new" | null>(null);
  const [people, setPeople] = useState<Cycle | null>(null);
  const list = useQuery({ queryKey: ["appraisal-cycles", ...scope], queryFn: performance.cycles.list });
  const act = useMutation({
    mutationFn: async ({ id, what }: { id: number; what: "activate" | "close" | "remove" }) => {
      if (what === "remove") await performance.cycles.remove(id);
      else await performance.cycles[what](id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appraisal-cycles"] }),
  });
  const columns: Column<Cycle>[] = [
    { id: "name", header: t("performance.cycles.name"), cell: (c) => <span className="flex flex-col"><span className="font-semibold text-ink">{format.name(c)}</span><span className="text-sm text-muted">{t(`performance.kinds.${c.kind}`)}</span></span> },
    { id: "period", header: t("performance.cycles.period"), cell: (c) => <span className="num text-sm">{format.dateRange(c.period_start, c.period_end)}</span> },
    { id: "status", header: t("performance.cycles.status"), cell: (c) => <Pill tone={STATUS_TONES[c.status]}>{t(`performance.statuses.${c.status}`)}</Pill> },
    { id: "phase", header: t("performance.cycles.phase"), cell: (c) => <span className="flex flex-wrap gap-1">{c.open_phases.length ? c.open_phases.map((p) => <Pill key={p} tone="teal">{t(`performance.phases.${p}`)}</Pill>) : "—"}</span> },
    {
      id: "people",
      header: t("performance.cycles.people"),
      cell: (c) => (
        <Button size="sm" variant="ghost" icon={<Users className="size-4" />} iconPosition="start" onClick={() => setPeople(c)}>
          {format.number(c.population_count)}
        </Button>
      ),
    },
    {
      id: "next",
      header: t("performance.cycles.next"),
      cell: (c) => (
        <span className="flex gap-2">
          {c.status === "draft" && <Button size="sm" variant="outline" onClick={() => act.mutate({ id: c.id, what: "activate" })}>{t("performance.cycles.activate")}</Button>}
          {c.status === "active" && <Button size="sm" variant="outline" onClick={() => act.mutate({ id: c.id, what: "close" })}>{t("performance.cycles.close")}</Button>}
        </span>
      ),
    },
  ];
  const actError = act.error ? apiErrors(act.error, t("common.saveFailed")) : null;
  return (
    <Card title={t("performance.cycles.title")} action={<Button variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>{t("performance.cycles.add")}</Button>}>
      <DataTable caption={t("performance.cycles.title")} columns={columns} rows={list.data?.results ?? []} rowKey={(c) => String(c.id)} rowLabel={(c) => c.name_ar} loading={list.isPending} empty={t("performance.cycles.empty")} onEdit={(c) => c.status !== "closed" && setEditing(c)} onDelete={(c) => act.mutate({ id: c.id, what: "remove" })} />
      {actError && <Alert className="mt-3">{Object.values(actError.fields)[0] ?? actError.general}</Alert>}
      {editing !== null && <CycleDialog row={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {people && <PopulationDialog cycle={people} onClose={() => setPeople(null)} />}
    </Card>
  );
}

function PopulationDialog({ cycle, onClose }: { cycle: Cycle; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const rows = useQuery({ queryKey: ["cycle-population", cycle.id], queryFn: () => performance.cycles.population(cycle.id) });
  return (
    <Dialog open onClose={onClose} title={`${t("performance.cycles.people")} · ${format.name(cycle)}`}>
      <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto text-sm">
        {(rows.data ?? []).map((e) => (
          <li key={e.id} className="flex justify-between gap-2 rounded-tile px-2 py-1.5 odd:bg-neutral-soft">
            <span>{format.name(e)} <span className="num text-muted">({e.employee_no})</span></span>
            <span className="text-muted">{e.department}</span>
          </li>
        ))}
        {rows.isSuccess && rows.data.length === 0 && <li className="text-muted">{t("performance.cycles.nobody")}</li>}
      </ul>
    </Dialog>
  );
}

function CycleDialog({ row, onClose }: { row: Cycle | null; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const templates = useQuery({ queryKey: ["appraisal-templates"], queryFn: performance.templates.list });
  const departments = useQuery({ queryKey: ["departments"], queryFn: endpoints.departments });
  const branches = useQuery({ queryKey: ["branches"], queryFn: hr.branches });
  const grades = useQuery({ queryKey: ["grades"], queryFn: hr.grades });
  const empty = Object.fromEntries(CYCLE_DATES.map((d) => [d, ""])) as Record<(typeof CYCLE_DATES)[number], string>;
  const [v, setV] = useState<CycleBody>(row ?? { name_ar: "", name_en: "", kind: "annual", template: null, ...empty, departments: [], branches: [], grades: [], min_service_days: 90 });
  const done = useSaved("appraisal-cycles", onClose);
  const save = useMutation({ mutationFn: () => performance.cycles.save({ ...v, id: row?.id }), onSuccess: done });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const toggle = (name: "departments" | "branches" | "grades", id: number, on: boolean) => setV({ ...v, [name]: on ? [...v[name], id] : v[name].filter((x) => x !== id) });
  const filters: ["departments" | "branches" | "grades", { id: number; name_ar: string; name_en: string }[]][] = [
    ["departments", departments.data?.results ?? []],
    ["branches", branches.data?.results ?? []],
    ["grades", grades.data?.results ?? []],
  ];
  return (
    <Dialog open onClose={onClose} size="lg" title={row ? t("performance.cycles.edit") : t("performance.cycles.add")} footer={<Footer disabled={save.isPending || !v.name_ar || !v.template} onSave={() => save.mutate()} />}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("performance.fields.nameAr")} name="name_ar" value={v.name_ar} onChange={(e) => setV({ ...v, name_ar: e.target.value })} error={errors.fields.name_ar} />
          <TextField label={t("performance.fields.nameEn")} name="name_en" dir="ltr" value={v.name_en} onChange={(e) => setV({ ...v, name_en: e.target.value })} />
          <FormSelect label={t("performance.cycles.kind")} name="kind" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as CycleKind })} options={(["annual", "semi_annual", "probation"] as const).map((k) => ({ value: k, label: t(`performance.kinds.${k}`) }))} />
          <FormSelect label={t("performance.cycles.template")} name="template" placeholder={t("common.choose")} value={v.template ?? ""} onChange={(e) => setV({ ...v, template: e.target.value ? Number(e.target.value) : null })} options={(templates.data?.results ?? []).filter((x) => x.is_active).map((x) => ({ value: String(x.id), label: format.name(x) }))} error={errors.fields.template} />
        </div>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-medium text-ink">{t("performance.cycles.dates")}</legend>
          {CYCLE_DATES.map((name) => (
            <DateInput key={name} label={t(`performance.dates.${name}`)} name={name} value={v[name] || null} onChange={(d) => setV({ ...v, [name]: d ?? "" })} error={errors.fields[name]} />
          ))}
        </fieldset>
        <TextField label={t("performance.cycles.minService")} name="min_service_days" type="number" min={0} max={730} dir="ltr" value={String(v.min_service_days)} onChange={(e) => setV({ ...v, min_service_days: Number(e.target.value) || 0 })} />
        {filters.map(([name, rows]) => (
          <fieldset key={name} className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-medium text-ink">{t(`performance.cycles.${name}`)}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {rows.map((r) => (
                <CheckField key={r.id} label={format.name(r)} checked={v[name].includes(r.id)} onChange={(e) => toggle(name, r.id, e.target.checked)} />
              ))}
            </div>
          </fieldset>
        ))}
        <p className="text-sm text-muted">{t("performance.cycles.filtersHint")}</p>
        {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

// --- templates ---------------------------------------------------------------------------------------------------

export function TemplatesCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AppraisalTemplate | "new" | null>(null);
  const list = useQuery({ queryKey: ["appraisal-templates"], queryFn: performance.templates.list });
  const remove = useMutation({ mutationFn: (id: number) => performance.templates.remove(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appraisal-templates"] }) });
  const columns: Column<AppraisalTemplate>[] = [
    { id: "name", header: t("performance.templates.name"), cell: (x) => <span className="font-semibold text-ink">{format.name(x)}</span> },
    { id: "weights", header: t("performance.templates.weights"), cell: (x) => <span className="num">{t("performance.templates.split", { goals: format.number(x.goals_weight, 0), competencies: format.number(x.competencies_weight, 0) })}</span> },
    { id: "items", header: t("performance.templates.competencies"), cell: (x) => <span className="num">{format.number(x.competency_items.length)}</span> },
    { id: "active", header: t("performance.fields.active"), cell: (x) => (x.is_active ? t("common.yes") : t("common.no")) },
  ];
  return (
    <Card title={t("performance.templates.title")} action={<Button variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>{t("performance.templates.add")}</Button>}>
      <DataTable caption={t("performance.templates.title")} columns={columns} rows={list.data?.results ?? []} rowKey={(x) => String(x.id)} rowLabel={(x) => x.name_ar} loading={list.isPending} minWidth={640} empty={t("performance.templates.empty")} onEdit={(x) => setEditing(x)} onDelete={(x) => remove.mutate(x.id)} />
      {remove.isError && <Alert className="mt-3">{apiErrors(remove.error, t("common.saveFailed")).general}</Alert>}
      {editing !== null && <TemplateDialog row={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function TemplateDialog({ row, onClose }: { row: AppraisalTemplate | null; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scales = useQuery({ queryKey: ["rating-scales"], queryFn: performance.scales.list });
  const competencies = useQuery({ queryKey: ["competencies"], queryFn: performance.competencies.list });
  const [v, setV] = useState<Omit<AppraisalTemplate, "id">>(row ?? { name_ar: "", name_en: "", scale: 0, goals_weight: "70", competencies_weight: "30", competency_items: [], questions: [], is_active: true });
  const done = useSaved("appraisal-templates", onClose);
  const save = useMutation({ mutationFn: () => performance.templates.save({ ...v, id: row?.id }), onSuccess: done });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const itemsTotal = v.competency_items.reduce((sum, i) => sum + (Number(i.weight) || 0), 0);
  return (
    <Dialog open onClose={onClose} size="lg" title={row ? t("performance.templates.edit") : t("performance.templates.add")} footer={<Footer disabled={save.isPending || !v.name_ar || !v.scale} onSave={() => save.mutate()} />}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("performance.fields.nameAr")} name="name_ar" value={v.name_ar} onChange={(e) => setV({ ...v, name_ar: e.target.value })} error={errors.fields.name_ar} />
          <TextField label={t("performance.fields.nameEn")} name="name_en" dir="ltr" value={v.name_en} onChange={(e) => setV({ ...v, name_en: e.target.value })} />
          <FormSelect label={t("performance.templates.scale")} name="scale" placeholder={t("common.choose")} value={v.scale ? String(v.scale) : ""} onChange={(e) => setV({ ...v, scale: Number(e.target.value) })} options={(scales.data?.results ?? []).filter((s) => s.is_active).map((s) => ({ value: String(s.id), label: format.name(s) }))} error={errors.fields.scale} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label={t("performance.templates.goalsWeight")} name="goals_weight" inputMode="decimal" dir="ltr" value={v.goals_weight} onChange={(e) => setV({ ...v, goals_weight: e.target.value })} />
            <TextField label={t("performance.templates.competenciesWeight")} name="competencies_weight" inputMode="decimal" dir="ltr" value={v.competencies_weight} onChange={(e) => setV({ ...v, competencies_weight: e.target.value })} error={errors.fields.competencies_weight} />
          </div>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">{t("performance.templates.competencies")} <span className="num text-muted">({format.number(itemsTotal)} %)</span></legend>
          {v.competency_items.map((item, i) => (
            <div key={i} className="grid grid-cols-[1fr_8rem_auto] items-end gap-3">
              <FormSelect label={t("performance.templates.competency")} name={`competency_${i}`} placeholder={t("common.choose")} value={item.competency ? String(item.competency) : ""} onChange={(e) => setV({ ...v, competency_items: v.competency_items.map((x, j) => (j === i ? { ...x, competency: Number(e.target.value) } : x)) })} options={(competencies.data?.results ?? []).filter((c) => c.is_active).map((c) => ({ value: String(c.id), label: format.name(c) }))} />
              <TextField label={t("performance.templates.weight")} name={`weight_${i}`} inputMode="decimal" dir="ltr" value={item.weight} onChange={(e) => setV({ ...v, competency_items: v.competency_items.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)) })} />
              <IconButton label={t("common.delete")} variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setV({ ...v, competency_items: v.competency_items.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <Button size="sm" variant="outline" className="self-start" icon={<Plus className="size-4" />} onClick={() => setV({ ...v, competency_items: [...v.competency_items, { competency: 0, weight: "" }] })}>
            {t("performance.templates.addCompetency")}
          </Button>
          {errors.fields.competency_items && <p className="text-sm text-danger">{errors.fields.competency_items}</p>}
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">{t("performance.templates.questions")}</legend>
          {v.questions.map((q, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
              <TextField label={t("performance.templates.questionAr")} name={`question_${i}_ar`} value={q.text_ar} onChange={(e) => setV({ ...v, questions: v.questions.map((x, j) => (j === i ? { ...x, text_ar: e.target.value } : x)) })} />
              <TextField label={t("performance.templates.questionEn")} name={`question_${i}_en`} dir="ltr" value={q.text_en} onChange={(e) => setV({ ...v, questions: v.questions.map((x, j) => (j === i ? { ...x, text_en: e.target.value } : x)) })} />
              <IconButton label={t("common.delete")} variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setV({ ...v, questions: v.questions.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <Button size="sm" variant="outline" className="self-start" icon={<Plus className="size-4" />} onClick={() => setV({ ...v, questions: [...v.questions, { text_ar: "", text_en: "" }] })}>
            {t("performance.templates.addQuestion")}
          </Button>
        </fieldset>
        <CheckField label={t("performance.fields.active")} checked={v.is_active} onChange={(e) => setV({ ...v, is_active: e.target.checked })} />
        {(errors.fields.detail || errors.fields.questions || errors.general) && <Alert>{errors.fields.detail ?? errors.fields.questions ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

// --- competencies -------------------------------------------------------------------------------------------------

export function CompetenciesCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Competency | "new" | null>(null);
  const list = useQuery({ queryKey: ["competencies"], queryFn: performance.competencies.list });
  const remove = useMutation({ mutationFn: (id: number) => performance.competencies.remove(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["competencies"] }) });
  const columns: Column<Competency>[] = [
    { id: "name", header: t("performance.competencies.name"), cell: (c) => <span className="flex flex-col"><span className="font-semibold text-ink">{format.name(c)}</span><span className="text-sm text-muted">{format.lang === "en" ? c.description_en || c.description_ar : c.description_ar}</span></span> },
    { id: "category", header: t("performance.competencies.category"), cell: (c) => <Pill tone="lavender">{t(`performance.categories.${c.category}`)}</Pill> },
    { id: "active", header: t("performance.fields.active"), cell: (c) => (c.is_active ? t("common.yes") : t("common.no")) },
  ];
  return (
    <Card title={t("performance.competencies.title")} action={<Button variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>{t("performance.competencies.add")}</Button>}>
      <DataTable caption={t("performance.competencies.title")} columns={columns} rows={list.data?.results ?? []} rowKey={(c) => String(c.id)} rowLabel={(c) => c.name_ar} loading={list.isPending} minWidth={640} empty={t("performance.competencies.empty")} onEdit={(c) => setEditing(c)} onDelete={(c) => remove.mutate(c.id)} />
      {remove.isError && <Alert className="mt-3">{apiErrors(remove.error, t("common.saveFailed")).general}</Alert>}
      {editing !== null && <CompetencyDialog row={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function CompetencyDialog({ row, onClose }: { row: Competency | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [v, setV] = useState<Omit<Competency, "id">>(row ?? { code: "", name_ar: "", name_en: "", category: "core", description_ar: "", description_en: "", job_titles: [], grades: [], is_active: true });
  const done = useSaved("competencies", onClose);
  const save = useMutation({ mutationFn: () => performance.competencies.save({ ...v, id: row?.id }), onSuccess: done });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog open onClose={onClose} title={row ? t("performance.competencies.edit") : t("performance.competencies.add")} footer={<Footer disabled={save.isPending || !v.name_ar || !v.code} onSave={() => save.mutate()} />}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("performance.competencies.code")} name="code" dir="ltr" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} error={errors.fields.code} />
          <FormSelect label={t("performance.competencies.category")} name="category" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value as CompetencyCategory })} options={CATEGORIES.map((c) => ({ value: c, label: t(`performance.categories.${c}`) }))} />
          <TextField label={t("performance.fields.nameAr")} name="name_ar" value={v.name_ar} onChange={(e) => setV({ ...v, name_ar: e.target.value })} error={errors.fields.name_ar} />
          <TextField label={t("performance.fields.nameEn")} name="name_en" dir="ltr" value={v.name_en} onChange={(e) => setV({ ...v, name_en: e.target.value })} />
        </div>
        <TextArea label={t("performance.competencies.descriptionAr")} name="description_ar" rows={2} value={v.description_ar} onChange={(e) => setV({ ...v, description_ar: e.target.value })} />
        <TextArea label={t("performance.competencies.descriptionEn")} name="description_en" rows={2} dir="ltr" value={v.description_en} onChange={(e) => setV({ ...v, description_en: e.target.value })} />
        <CheckField label={t("performance.fields.active")} checked={v.is_active} onChange={(e) => setV({ ...v, is_active: e.target.checked })} />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

// --- rating scales -------------------------------------------------------------------------------------------------

export function ScalesCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<RatingScale | "new" | null>(null);
  const list = useQuery({ queryKey: ["rating-scales"], queryFn: performance.scales.list });
  const remove = useMutation({ mutationFn: (id: number) => performance.scales.remove(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rating-scales"] }) });
  const columns: Column<RatingScale>[] = [
    { id: "name", header: t("performance.scales.name"), cell: (s) => <span className="font-semibold text-ink">{format.name(s)}</span> },
    { id: "levels", header: t("performance.scales.levels"), cell: (s) => <span className="flex flex-wrap gap-1">{s.levels.map((l) => <Pill key={l.value} tone="sky">{`${format.number(l.value)} · ${format.name(l)}`}</Pill>)}</span> },
  ];
  return (
    <Card title={t("performance.scales.title")} action={<Button variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>{t("performance.scales.add")}</Button>}>
      <DataTable caption={t("performance.scales.title")} columns={columns} rows={list.data?.results ?? []} rowKey={(s) => String(s.id)} rowLabel={(s) => s.name_ar} loading={list.isPending} minWidth={640} empty={t("performance.scales.empty")} onEdit={(s) => setEditing(s)} onDelete={(s) => remove.mutate(s.id)} />
      {remove.isError && <Alert className="mt-3">{apiErrors(remove.error, t("common.saveFailed")).general}</Alert>}
      {editing !== null && <ScaleDialog row={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function ScaleDialog({ row, onClose }: { row: RatingScale | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [v, setV] = useState<Omit<RatingScale, "id">>(row ?? { name_ar: "", name_en: "", is_active: true, levels: [1, 2, 3, 4, 5].map((n) => ({ value: n, name_ar: "", name_en: "", description_ar: "", description_en: "" })) });
  const done = useSaved("rating-scales", onClose);
  const save = useMutation({ mutationFn: () => performance.scales.save({ ...v, levels: v.levels.map((l, i) => ({ ...l, value: i + 1 })), id: row?.id }), onSuccess: done });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const setLevel = (i: number, patch: Partial<RatingScale["levels"][number]>) => setV({ ...v, levels: v.levels.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  return (
    <Dialog open onClose={onClose} size="lg" title={row ? t("performance.scales.edit") : t("performance.scales.add")} footer={<Footer disabled={save.isPending || !v.name_ar || v.levels.some((l) => !l.name_ar)} onSave={() => save.mutate()} />}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("performance.fields.nameAr")} name="name_ar" value={v.name_ar} onChange={(e) => setV({ ...v, name_ar: e.target.value })} error={errors.fields.name_ar} />
          <TextField label={t("performance.fields.nameEn")} name="name_en" dir="ltr" value={v.name_en} onChange={(e) => setV({ ...v, name_en: e.target.value })} />
        </div>
        {v.levels.map((level, i) => (
          <div key={i} className="grid grid-cols-[2.5rem_1fr_1fr_auto] items-end gap-3">
            <span className="num pb-3 text-center text-lg font-semibold">{i + 1}</span>
            <TextField label={t("performance.scales.levelAr")} name={`level_${i}_ar`} value={level.name_ar} onChange={(e) => setLevel(i, { name_ar: e.target.value })} />
            <TextField label={t("performance.scales.levelEn")} name={`level_${i}_en`} dir="ltr" value={level.name_en} onChange={(e) => setLevel(i, { name_en: e.target.value })} />
            <IconButton label={t("common.delete")} variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setV({ ...v, levels: v.levels.filter((_, j) => j !== i) })} />
          </div>
        ))}
        <Button size="sm" variant="outline" className="self-start" icon={<Plus className="size-4" />} onClick={() => setV({ ...v, levels: [...v.levels, { value: v.levels.length + 1, name_ar: "", name_en: "", description_ar: "", description_en: "" }] })}>
          {t("performance.scales.addLevel")}
        </Button>
        {errors.fields.levels && <p className="text-sm text-danger">{errors.fields.levels}</p>}
        <CheckField label={t("performance.fields.active")} checked={v.is_active} onChange={(e) => setV({ ...v, is_active: e.target.checked })} />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
